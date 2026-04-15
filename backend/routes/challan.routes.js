const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Challan = require('../models/Challan.model');
const Dock = require('../models/Dock.model');
const { verifyToken, authorizeRoles, checkWarehouseAccess } = require('../middleware/auth.middleware');
const { asyncHandler, AppError, validationError } = require('../middleware/error.middleware');
const ocrService = require('../services/ocr.service');

const router = express.Router();

// Create new challan (GUARD only)
router.post('/', verifyToken, authorizeRoles('GUARD'), [
  body('imageUrl')
    .isURL()
    .withMessage('Image URL is required and must be valid'),

  body('vehicleNo')
    .trim()
    .notEmpty()
    .withMessage('Vehicle number is required')
    .matches(/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$/)
    .withMessage('Invalid vehicle number format'),

  body('vendorName')
    .trim()
    .notEmpty()
    .withMessage('Vendor name is required'),

  body('itemsList')
    .isArray({ min: 1 })
    .withMessage('Items list must contain at least one item'),

  body('itemsList.*.itemName')
    .trim()
    .notEmpty()
    .withMessage('Item name is required'),

  body('itemsList.*.quantity')
    .isNumeric()
    .withMessage('Item quantity must be a number')
    .isFloat({ min: 0 })
    .withMessage('Item quantity must be positive'),

  body('itemsList.*.unit')
    .isIn(['kg', 'tons', 'pcs', 'boxes', 'liters', 'meters'])
    .withMessage('Invalid unit'),

  body('totalWeight')
    .isNumeric()
    .withMessage('Total weight must be a number')
    .isFloat({ min: 0 })
    .withMessage('Total weight must be positive'),

  body('declaredLoad')
    .isIn(['FULL', 'HALF', 'EMPTY'])
    .withMessage('Invalid declared load'),

  body('visualLoad')
    .isIn(['FULL', 'HALF', 'EMPTY'])
    .withMessage('Invalid visual load'),

  body('destination')
    .trim()
    .notEmpty()
    .withMessage('Destination is required'),

  body('warehouseId')
    .trim()
    .notEmpty()
    .withMessage('Warehouse ID is required'),

  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Invalid priority'),

  body('temperature')
    .optional()
    .isNumeric()
    .withMessage('Temperature must be a number'),

  body('humidity')
    .optional()
    .isNumeric()
    .withMessage('Humidity must be a number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const challanData = {
    ...req.body,
    scannedBy: req.user._id
  };

  // Create new challan
  const challan = new Challan(challanData);
  await challan.save();

  // Check for mismatch
  const hasMismatch = challan.checkMismatch();
  if (hasMismatch) {
    // Emit Socket.IO event for mismatch
    req.io.emit('mismatch:flagged', {
      challan: challan,
      reason: 'Declared load does not match visual load',
      timestamp: new Date()
    });
  }

  // Emit Socket.IO event for challan scanned
  req.io.emit('challan:scanned', {
    challan: challan,
    scannedBy: req.user.toPublicJSON(),
    warehouseId: challan.warehouseId,
    timestamp: new Date()
  });

  res.status(201).json({
    success: true,
    message: 'Challan created successfully',
    data: {
    }
  });
}));

// Process OCR for a challan image (GUARD/AUTHORITY/ADMIN only)
router.post('/ocr', verifyToken, authorizeRoles('GUARD', 'AUTHORITY', 'ADMIN'), [
  body('imageUrl')
    .notEmpty()
    .withMessage('Image source (URL or Base64) is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { imageUrl } = req.body;
  
  // 🔍 DEBUG: Log frontend data
  if (imageUrl) {
    const mimeMatch = imageUrl.match(/^data:(image\/\w+);base64,/);
    console.log('[OCR Route] imageBase64 substring(0,50):', imageUrl.substring(0, 50));
    console.log('[OCR Route] detected MIME type:', mimeMatch ? mimeMatch[1] : 'unknown');
  }

  try {
    const rawExtracted = await ocrService.processChallanImage(imageUrl);

    // Normalize Gemini output keys → frontend schema
    // New prompt returns: challan_number, truck_number, from, to, goods_description, weight, total_value, capacity
    // Frontend expects: challanId, vehicleNo, vendorName, destination, cargoDescription, totalWeight, value, declaredLoad
    const extractedData = {
      challanId:        rawExtracted.challan_number  || rawExtracted.challanId        || null,
      vehicleNo:        rawExtracted.truck_number     || rawExtracted.vehicleNo         || null,
      vendorName:       rawExtracted.from             || rawExtracted.vendorName        || null,
      destination:      rawExtracted.to               || rawExtracted.destination       || null,
      cargoDescription: rawExtracted.goods_description|| rawExtracted.cargoDescription  || null,
      totalWeight:      rawExtracted.weight           || rawExtracted.totalWeight       || null,
      value:            rawExtracted.total_value      || rawExtracted.value             || null,
      declaredLoad:     rawExtracted.capacity         || rawExtracted.declaredLoad      || null,
      date:             rawExtracted.date             || null,
    };

    // Normalize declaredLoad to FULL / HALF / EMPTY
    if (extractedData.declaredLoad) {
      const dl = extractedData.declaredLoad.toString().toUpperCase();
      extractedData.declaredLoad = dl.includes('FULL') ? 'FULL'
        : dl.includes('HALF') ? 'HALF'
        : dl.includes('EMPTY') ? 'EMPTY'
        : null;
    }

    // Flag which fields were actually extracted vs null
    const fieldSources = {};
    for (const [key, val] of Object.entries(extractedData)) {
      fieldSources[key] = (val !== null && val !== undefined && val !== 'Not Found') ? 'ai' : 'missing';
    }

    console.log('[OCR Route] Normalized extractedData:', JSON.stringify(extractedData));
    console.log('[OCR Route] fieldSources:', JSON.stringify(fieldSources));

    res.json({
      success: true,
      data: extractedData,
      fieldSources
    });
  } catch (error) {
    throw new AppError(`OCR Processing failed: ${error.message}`, 500);
  }
}));


// Process OCR for a license plate image (GUARD/AUTHORITY/ADMIN only)
router.post('/ocr-plate', verifyToken, authorizeRoles('GUARD', 'AUTHORITY', 'ADMIN'), [
  body('imageUrl')
    .notEmpty()
    .withMessage('Image source (URL or Base64) is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { imageUrl } = req.body;

  // 🔍 DEBUG: Log frontend data
  if (imageUrl) {
    console.log('[Plate OCR Route] imageBase64 substring(0,50):', imageUrl.substring(0, 50));
  }

  try {
    const extractedData = await ocrService.processPlateImage(imageUrl);

    res.json({
      success: true,
      data: extractedData
    });
  } catch (error) {
    throw new AppError(`Plate OCR Processing failed: ${error.message}`, 500);
  }
}));

// END OF OCR ROUTES

// Get all challans for warehouse
router.get('/', verifyToken, [
  // Query validation will be handled manually for flexibility
], asyncHandler(async (req, res) => {
  const {
    warehouseId,
    page = 1,
    limit = 10,
    status,
    vehicleNo,
    vendorName,
    startDate,
    endDate,
    priority
  } = req.query;

  // Build query
  const query = {};

  if (warehouseId) {
    // Check warehouse access
    if (req.user.role !== 'ADMIN' && req.user.warehouseId !== warehouseId) {
      throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
    }
    query.warehouseId = warehouseId;
  } else if (req.user.role !== 'ADMIN') {
    query.warehouseId = req.user.warehouseId;
  }

  if (status) query.status = status;
  if (vehicleNo) query.vehicleNo = { $regex: vehicleNo, $options: 'i' };
  if (vendorName) query.vendorName = { $regex: vendorName, $options: 'i' };
  if (priority) query.priority = priority;

  if (startDate || endDate) {
    query.scannedAt = {};
    if (startDate) query.scannedAt.$gte = new Date(startDate);
    if (endDate) query.scannedAt.$lte = new Date(endDate);
  }

  const challans = await Challan.find(query)
    .populate('scannedBy', 'name email role')
    .populate('verifiedBy', 'name email role')
    .sort({ scannedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Challan.countDocuments(query);

  res.json({
    success: true,
    message: 'Challans retrieved successfully',
    data: {
      challans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get pending inbound challans for drivers
router.get('/pending/warehouse', verifyToken, asyncHandler(async (req, res) => {
  const { warehouseId } = req.query;

  const query = {
    status: 'PENDING'
  };

  if (warehouseId) query.warehouseId = warehouseId;

  const challans = await Challan.find(query)
    .populate('scannedBy', 'name email role')
    .sort({ scannedAt: -1 });

  res.json({
    success: true,
    data: { challans }
  });
}));

// Accept inbound challan (DRIVER only)
router.patch('/:id/accept', verifyToken, authorizeRoles('DRIVER'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const challan = await Challan.findOne({ challanId: id });

  if (!challan) {
    throw new AppError('Challan not found', 404);
  }

  if (challan.driverId) {
    throw new AppError('Challan already assigned to another driver', 400);
  }

  challan.driverId = req.user._id;
  // We keep status as PENDING or move to IN_TRANSIT? 
  // For Outbound we have IN_TRANSIT. Let's use IN_TRANSIT here too if applicable.
  // Actually, Challan status are PENDING, VERIFIED, MISMATCH, FLAGGED.
  // Let's add 'IN_TRANSIT' to Challan model status enum if needed.
  // Viewing model again.

  await challan.save();

  req.io.to(challan.warehouseId).emit('challan:accepted', {
    challanId: challan.challanId,
    driverId: req.user._id,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Challan accepted successfully',
    data: { challan }
  });
}));

// Update live location for inbound (DRIVER only)
router.patch('/:id/location', verifyToken, authorizeRoles('DRIVER'), [
  body('lat').isNumeric(),
  body('lng').isNumeric(),
  body('eta').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw validationError(errors.array());

  const { id } = req.params;
  const { lat, lng, eta } = req.body;

  const challan = await Challan.findOne({ challanId: id });
  if (!challan) throw new AppError('Challan not found', 404);

  // Update location
  await challan.updateLocation(lat, lng, eta);

  // Broadcast to warehouse room
  req.io.to(challan.warehouseId).emit('challan:location:updated', {
    challanId: challan.challanId,
    location: { lat, lng },
    eta: challan.eta,
    timestamp: new Date()
  });

  res.json({
    success: true,
    data: {
      challanId: challan.challanId,
      location: { lat, lng },
      eta: challan.eta
    }
  });
}));

// Get single challan by ID
router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const challan = await Challan.findOne({ challanId: id })
    .populate('scannedBy', 'name email role')
    .populate('verifiedBy', 'name email role');

  if (!challan) {
    throw new AppError('Challan not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== challan.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  res.json({
    success: true,
    message: 'Challan retrieved successfully',
    data: {
      challan
    }
  });
}));

// Update challan status (AUTHORITY/ADMIN/MANAGER only)
router.patch('/:id/status', verifyToken, authorizeRoles('AUTHORITY', 'ADMIN', 'WAREHOUSE_MANAGER'), [
  body('status')
    .isIn(['PENDING', 'VERIFIED', 'MISMATCH', 'FLAGGED'])
    .withMessage('Invalid status'),

  body('mismatchNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Mismatch notes cannot exceed 500 characters'),

  body('dockAssigned')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Dock assignment cannot be empty')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { status, mismatchNotes, dockAssigned } = req.body;

  let challan = await Challan.findOne({ challanId: id });
  
  if (!challan && mongoose.Types.ObjectId.isValid(id)) {
    challan = await Challan.findById(id);
  }

  if (!challan) {
    throw new AppError('Challan not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== challan.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Update challan
  challan.status = status;
  if (mismatchNotes) challan.mismatchNotes = mismatchNotes;
  if (dockAssigned) challan.dockAssigned = dockAssigned;

  if (status === 'VERIFIED') {
    challan.verifiedBy = req.user._id;
    challan.verifiedAt = new Date();
    challan.calculateGateDuration();

    // Update Dock status to OCCUPIED if dock is assigned
    if (challan.dockAssigned) {
      try {
        // Normalize dock identifier: strip 'dock' prefix, spaces, dashes
        const rawId = challan.dockAssigned.replace(/dock/gi, '').trim();
        // Try exact match first, then flexible fallback
        let dock = await Dock.findOne({ 
          warehouseId: challan.warehouseId, 
          dockNumber: { $regex: new RegExp(`^${rawId}$`, 'i') } 
        });

        // Fallback: match with optional dash/space (D07 matches D-07, D 07)
        if (!dock) {
          const flexId = rawId.replace(/[-\s]/g, '').trim();
          const allDocks = await Dock.find({ warehouseId: challan.warehouseId });
          dock = allDocks.find(d => {
            const normalized = (d.dockNumber || '').replace(/dock/gi, '').replace(/[-\s]/g, '').trim();
            return normalized.toLowerCase() === flexId.toLowerCase();
          }) || null;
        }

        if (dock) {
          console.log(`[Dock] Matched dock: ${dock.dockNumber} for identifier: ${challan.dockAssigned}`);
          dock.status = 'OCCUPIED';
          dock.assignedTruck = challan.vehicleNo;
          dock.assignedChallanId = challan._id;
          dock.lastUsed = new Date();
          await dock.save();
          
          // Emit socket update with full dock object
          req.io.emit('dock:updated', {
            dock: dock.toObject(),
            warehouseId: challan.warehouseId
          });
        } else {
          console.warn(`[Dock] No dock found for identifier: "${challan.dockAssigned}" in warehouse: ${challan.warehouseId}`);
        }
      } catch (dockErr) {
        console.error('Error updating dock status:', dockErr);
      }
    }
  }

  await challan.save();

  // Emit Socket.IO event for dock update
  if (dockAssigned || status === 'VERIFIED') {
    req.io.emit('dock:updated', {
      challan: challan,
      updatedBy: req.user.toPublicJSON(),
      warehouseId: challan.warehouseId,
      timestamp: new Date()
    });
  }

  // Emit Socket.IO event for status update
  req.io.emit('challan:status:updated', {
    challan: challan,
    updatedBy: req.user.toPublicJSON(),
    warehouseId: challan.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Challan status updated successfully',
    data: {
      challan: await Challan.findById(challan._id)
        .populate('scannedBy', 'name email role')
        .populate('verifiedBy', 'name email role')
    }
  });
}));

// Get challan statistics
router.get('/stats/warehouse', verifyToken, asyncHandler(async (req, res) => {
  const { warehouseId, startDate, endDate } = req.query;

  // Build query
  const matchQuery = {};

  if (warehouseId) {
    // Check warehouse access
    if (req.user.role !== 'ADMIN' && req.user.warehouseId !== warehouseId) {
      throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
    }
    matchQuery.warehouseId = warehouseId;
  } else if (req.user.role !== 'ADMIN') {
    matchQuery.warehouseId = req.user.warehouseId;
  }

  if (startDate || endDate) {
    matchQuery.scannedAt = {};
    if (startDate) matchQuery.scannedAt.$gte = new Date(startDate);
    if (endDate) matchQuery.scannedAt.$lte = new Date(endDate);
  }

  const stats = await Challan.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgGateDuration: { $avg: '$gateDuration' }
      }
    }
  ]);

  const totalChallans = await Challan.countDocuments(matchQuery);
  const mismatchCount = await Challan.countDocuments({ ...matchQuery, status: 'MISMATCH' });
  const verifiedCount = await Challan.countDocuments({ ...matchQuery, status: 'VERIFIED' });

  res.json({
    success: true,
    message: 'Challan statistics retrieved successfully',
    data: {
      totalChallans,
      mismatchCount,
      verifiedCount,
      mismatchRate: totalChallans > 0 ? ((mismatchCount / totalChallans) * 100).toFixed(2) : 0,
      verificationRate: totalChallans > 0 ? ((verifiedCount / totalChallans) * 100).toFixed(2) : 0,
      statusBreakdown: stats
    }
  });
}));

// Get recent challans (last 24 hours)
router.get('/recent/warehouse', verifyToken, asyncHandler(async (req, res) => {
  const { warehouseId } = req.query;

  // Build query
  const query = {
    scannedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  };

  if (warehouseId) {
    // Check warehouse access
    if (req.user.role !== 'ADMIN' && req.user.warehouseId !== warehouseId) {
      throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
    }
    query.warehouseId = warehouseId;
  } else if (req.user.role !== 'ADMIN') {
    query.warehouseId = req.user.warehouseId;
  }

  const recentChallans = await Challan.find(query)
    .populate('scannedBy', 'name email role')
    .sort({ scannedAt: -1 })
    .limit(10);

  res.json({
    success: true,
    message: 'Recent challans retrieved successfully',
    data: {
      challans: recentChallans
    }
  });
}));

// Delete challan (ADMIN only)
router.delete('/:id', verifyToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const challan = await Challan.findOne({ challanId: id });

  if (!challan) {
    throw new AppError('Challan not found', 404);
  }

  await Challan.deleteOne({ challanId: id });

  // Emit Socket.IO event for challan deletion
  req.io.emit('challan:deleted', {
    challanId: id,
    deletedBy: req.user.toPublicJSON(),
    warehouseId: challan.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Challan deleted successfully'
  });
}));

// Routes consolidated above

module.exports = router;
