const express = require('express');
const { body, validationResult } = require('express-validator');
const Dock = require('../models/Dock.model');
const Challan = require('../models/Challan.model');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');
const { asyncHandler, AppError, validationError } = require('../middleware/error.middleware');

const router = express.Router();

// Get all docks for warehouse
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const { warehouseId, status, page = 1, limit = 10 } = req.query;

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

  const docks = await Dock.find(query)
    .populate('assignedChallanId', 'challanId vehicleNo vendorName status')
    .sort({ dockNumber: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Dock.countDocuments(query);

  res.json({
    success: true,
    message: 'Docks retrieved successfully',
    data: {
      docks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get single dock by ID
router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const dock = await Dock.findById(id)
    .populate('assignedChallanId', 'challanId vehicleNo vendorName status scannedBy');

  if (!dock) {
    throw new AppError('Dock not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== dock.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  res.json({
    success: true,
    message: 'Dock retrieved successfully',
    data: {
      dock
    }
  });
}));

// Assign truck to dock (WAREHOUSE_MANAGER/ADMIN only)
router.patch('/:id/assign', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('truckNumber')
    .trim()
    .notEmpty()
    .withMessage('Truck number is required')
    .matches(/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$/)
    .withMessage('Invalid truck number format'),
  
  body('challanId')
    .notEmpty()
    .withMessage('Challan ID is required'),
  
  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('Start time must be a valid date'),
  
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid date'),
  
  body('operation')
    .optional()
    .isIn(['LOADING', 'UNLOADING', 'INSPECTION'])
    .withMessage('Invalid operation type')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { truckNumber, challanId, startTime, endTime, operation } = req.body;

  const dock = await Dock.findById(id);
  
  if (!dock) {
    throw new AppError('Dock not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== dock.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Check if dock is available
  if (dock.status === 'MAINTENANCE') {
    throw new AppError('Dock is under maintenance and cannot be assigned', 400);
  }

  // Find the challan
  const challan = await Challan.findOne({ challanId: challanId });
  if (!challan) {
    throw new AppError('Challan not found', 404);
  }

  // Check warehouse access for challan
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== challan.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Assign truck to dock
  dock.assignTruck(
    truckNumber, 
    challan._id, 
    startTime ? new Date(startTime) : new Date(), 
    endTime ? new Date(endTime) : new Date(Date.now() + 4 * 60 * 60 * 1000) // Default 4 hours
  );

  if (operation) {
    dock.currentOperation = operation;
  }

  await dock.save();

  // Update challan with dock assignment
  challan.dockAssigned = dock.dockNumber;
  await challan.save();

  // Emit Socket.IO event for dock update
  req.io.emit('dock:updated', {
    dock: await Dock.findById(dock._id).populate('assignedChallanId', 'challanId vehicleNo vendorName status'),
    assignedBy: req.user.toPublicJSON(),
    warehouseId: dock.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Truck assigned to dock successfully',
    data: {
      dock: await Dock.findById(dock._id).populate('assignedChallanId', 'challanId vehicleNo vendorName status')
    }
  });
}));

// Release dock (WAREHOUSE_MANAGER/ADMIN only)
router.patch('/:id/release', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { notes } = req.body;

  const dock = await Dock.findById(id);
  
  if (!dock) {
    throw new AppError('Dock not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== dock.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Calculate utilization time
  if (dock.slotStart) {
    const utilizationMinutes = (new Date() - dock.slotStart) / (1000 * 60);
    dock.utilizationTime += utilizationMinutes;
  }

  // Store previous assignment for notification
  const previousAssignment = {
    truckNumber: dock.assignedTruck,
    challanId: dock.assignedChallanId
  };

  // Release dock
  dock.releaseDock();
  
  if (notes) {
    dock.notes = notes;
  }

  await dock.save();

  // Update associated challan
  if (previousAssignment.challanId) {
    await Challan.findByIdAndUpdate(
      previousAssignment.challanId,
      { $unset: { dockAssigned: 1 } }
    );
  }

  // Emit Socket.IO event for dock release
  req.io.emit('dock:released', {
    dock: dock,
    releasedBy: req.user.toPublicJSON(),
    warehouseId: dock.warehouseId,
    previousAssignment,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Dock released successfully',
    data: {
      dock
    }
  });
}));

// Schedule dock for future time slot
router.patch('/:id/schedule', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('truckNumber')
    .trim()
    .notEmpty()
    .withMessage('Truck number is required')
    .matches(/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$/)
    .withMessage('Invalid truck number format'),
  
  body('challanId')
    .notEmpty()
    .withMessage('Challan ID is required'),
  
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start time must be in the future');
      }
      return true;
    }),
  
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    })
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { truckNumber, challanId, startTime, endTime } = req.body;

  const dock = await Dock.findById(id);
  
  if (!dock) {
    throw new AppError('Dock not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== dock.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Check if dock is available for the requested time slot
  if (!dock.isAvailableForSlot(new Date(startTime), new Date(endTime))) {
    throw new AppError('Dock is not available for the requested time slot', 400);
  }

  // Find the challan
  const challan = await Challan.findOne({ challanId: challanId });
  if (!challan) {
    throw new AppError('Challan not found', 404);
  }

  // Schedule dock
  dock.scheduleDock(
    truckNumber, 
    challan._id, 
    new Date(startTime), 
    new Date(endTime)
  );

  await dock.save();

  // Emit Socket.IO event for dock scheduling
  req.io.emit('dock:scheduled', {
    dock: await Dock.findById(dock._id).populate('assignedChallanId', 'challanId vehicleNo vendorName status'),
    scheduledBy: req.user.toPublicJSON(),
    warehouseId: dock.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Dock scheduled successfully',
    data: {
      dock: await Dock.findById(dock._id).populate('assignedChallanId', 'challanId vehicleNo vendorName status')
    }
  });
}));

// Get dock statistics for warehouse
router.get('/stats/warehouse', verifyToken, asyncHandler(async (req, res) => {
  const { warehouseId } = req.query;

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

  const stats = await Dock.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgUtilizationTime: { $avg: '$utilizationTime' }
      }
    }
  ]);

  const totalDocks = await Dock.countDocuments(matchQuery);
  const availableDocks = await Dock.countDocuments({ ...matchQuery, status: 'AVAILABLE' });
  const occupiedDocks = await Dock.countDocuments({ ...matchQuery, status: 'OCCUPIED' });
  const scheduledDocks = await Dock.countDocuments({ ...matchQuery, status: 'SCHEDULED' });

  res.json({
    success: true,
    message: 'Dock statistics retrieved successfully',
    data: {
      totalDocks,
      availableDocks,
      occupiedDocks,
      scheduledDocks,
      occupancyRate: totalDocks > 0 ? ((occupiedDocks / totalDocks) * 100).toFixed(2) : 0,
      statusBreakdown: stats
    }
  });
}));

// Update dock maintenance status
router.patch('/:id/maintenance', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('status')
    .isIn(['AVAILABLE', 'MAINTENANCE'])
    .withMessage('Invalid maintenance status'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  const dock = await Dock.findById(id);
  
  if (!dock) {
    throw new AppError('Dock not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== dock.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // If setting to maintenance, check if dock is occupied
  if (status === 'MAINTENANCE' && dock.status === 'OCCUPIED') {
    throw new AppError('Cannot set occupied dock to maintenance. Please release the dock first.', 400);
  }

  dock.status = status;
  if (notes) dock.notes = notes;

  await dock.save();

  // Emit Socket.IO event for maintenance update
  req.io.emit('dock:maintenance:updated', {
    dock: dock,
    updatedBy: req.user.toPublicJSON(),
    warehouseId: dock.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: `Dock maintenance status updated to ${status}`,
    data: {
      dock
    }
  });
}));

module.exports = router;
