const express = require('express');
const { body, validationResult } = require('express-validator');
const InventoryItem = require('../models/InventoryItem.model');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');
const { asyncHandler, AppError, validationError } = require('../middleware/error.middleware');

const router = express.Router();

// Get inventory items — DRIVERs only see marketplace-visible items
router.get('/', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN', 'DRIVER'), asyncHandler(async (req, res) => {
  const { 
    warehouseId, 
    page = 1, 
    limit = 10, 
    category, 
    status, 
    search,
    lowStock,
    sortBy = 'name',
    sortOrder = 'asc'
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
  
  if (category) query.category = category;
  if (status) query.status = status;
  if (lowStock === 'true') query.status = 'LOW_STOCK';
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { binLocation: { $regex: search, $options: 'i' } }
    ];
  }

  // Drivers only see marketplace-visible stock
  if (req.user.role === 'DRIVER') {
    query.marketplaceVisible = { $ne: false };
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const inventoryItems = await InventoryItem.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await InventoryItem.countDocuments(query);

  res.json({
    success: true,
    message: 'Inventory items retrieved successfully',
    data: {
      inventoryItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get single inventory item by SKU
router.get('/:sku', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), asyncHandler(async (req, res) => {
  const { sku } = req.params;

  const inventoryItem = await InventoryItem.findOne({ sku: sku.toUpperCase() });

  if (!inventoryItem) {
    throw new AppError('Inventory item not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  res.json({
    success: true,
    message: 'Inventory item retrieved successfully',
    data: {
      inventoryItem
    }
  });
}));

// Create new inventory item (WAREHOUSE_MANAGER/ADMIN only)
router.post('/', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('SKU must contain only uppercase letters, numbers, and hyphens'),
  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Item name must be between 2 and 200 characters'),
  
  body('category')
    .isIn(['ELECTRONICS', 'FMCG', 'AUTO_PARTS', 'PHARMA', 'TEXTILES', 'STEEL', 'CHEMICALS', 'FOOD', 'BEVERAGES', 'OTHER'])
    .withMessage('Invalid category'),
  
  body('currentQty')
    .isNumeric()
    .withMessage('Current quantity must be a number')
    .isFloat({ min: 0 })
    .withMessage('Current quantity must be positive'),
  
  body('warehouseId')
    .trim()
    .notEmpty()
    .withMessage('Warehouse ID is required'),
  
  body('binLocation')
    .trim()
    .notEmpty()
    .withMessage('Bin location is required'),
  
  body('unit')
    .isIn(['kg', 'tons', 'pcs', 'boxes', 'liters', 'meters', 'pairs', 'sets'])
    .withMessage('Invalid unit'),
  
  body('unitPrice')
    .optional()
    .isNumeric()
    .withMessage('Unit price must be a number')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be positive'),
  
  body('lowStockThreshold')
    .optional()
    .isNumeric()
    .withMessage('Low stock threshold must be a number')
    .isFloat({ min: 0 })
    .withMessage('Low stock threshold must be positive'),
  
  body('supplier.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Supplier name is required'),
  
  body('supplier.phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Supplier phone must be valid')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const inventoryData = {
    ...req.body,
    sku: req.body.sku.toUpperCase()
  };

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryData.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Check if SKU already exists
  const existingItem = await InventoryItem.findOne({ sku: inventoryData.sku });
  if (existingItem) {
    throw new AppError('Item with this SKU already exists', 400);
  }

  // Create new inventory item
  const inventoryItem = new InventoryItem(inventoryData);
  await inventoryItem.save();

  // Check if stock is low and emit event
  if (inventoryItem.status === 'LOW_STOCK') {
    req.io.emit('stock:low', {
      inventoryItem: inventoryItem,
      warehouseId: inventoryItem.warehouseId,
      message: `Low stock alert: ${inventoryItem.name} (${inventoryItem.sku})`,
      timestamp: new Date()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Inventory item created successfully',
    data: {
      inventoryItem
    }
  });
}));

// Update inventory item (WAREHOUSE_MANAGER/ADMIN only)
router.patch('/:id', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('currentQty')
    .optional()
    .isNumeric()
    .withMessage('Current quantity must be a number')
    .isFloat({ min: 0 })
    .withMessage('Current quantity must be positive'),
  
  body('reservedQty')
    .optional()
    .isNumeric()
    .withMessage('Reserved quantity must be a number')
    .isFloat({ min: 0 })
    .withMessage('Reserved quantity must be positive'),
  
  body('lowStockThreshold')
    .optional()
    .isNumeric()
    .withMessage('Low stock threshold must be a number')
    .isFloat({ min: 0 })
    .withMessage('Low stock threshold must be positive'),
  
  body('binLocation')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Bin location cannot be empty'),
  
  body('unitPrice')
    .optional()
    .isNumeric()
    .withMessage('Unit price must be a number')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be positive'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  const inventoryItem = await InventoryItem.findById(id);
  
  if (!inventoryItem) {
    throw new AppError('Inventory item not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Store previous status for comparison
  const previousStatus = inventoryItem.status;

  // Update fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      inventoryItem[key] = updateData[key];
    }
  });

  await inventoryItem.save();

  // Check if status changed to low stock and emit event
  if (previousStatus !== 'LOW_STOCK' && inventoryItem.status === 'LOW_STOCK') {
    req.io.emit('stock:low', {
      inventoryItem: inventoryItem,
      warehouseId: inventoryItem.warehouseId,
      message: `Low stock alert: ${inventoryItem.name} (${inventoryItem.sku}) - Available: ${inventoryItem.getAvailableQuantity()} ${inventoryItem.unit}`,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Inventory item updated successfully',
    data: {
      inventoryItem
    }
  });
}));

// Add stock to inventory item
router.post('/:id/add-stock', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('quantity')
    .isNumeric()
    .withMessage('Quantity must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('reference')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Reference cannot be empty')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { quantity, reference } = req.body;

  const inventoryItem = await InventoryItem.findById(id);
  
  if (!inventoryItem) {
    throw new AppError('Inventory item not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Store previous status
  const previousStatus = inventoryItem.status;

  // Add stock
  inventoryItem.addStock(quantity, reference || `Manual addition by ${req.user.name}`);
  await inventoryItem.save();

  // Emit stock added event
  req.io.emit('stock:added', {
    inventoryItem,
    quantity,
    reference: reference || `Manual addition by ${req.user.name}`,
    addedBy: req.user.toPublicJSON(),
    warehouseId: inventoryItem.warehouseId,
    timestamp: new Date()
  });

  // 📡 inventory_update — push live stock level to Driver Marketplace
  req.io.emit('inventory_update', {
    inventoryId: inventoryItem._id,
    sku: inventoryItem.sku,
    name: inventoryItem.name,
    available: inventoryItem.getAvailableQuantity(),
    status: inventoryItem.status,
    marketplaceVisible: inventoryItem.marketplaceVisible,
    warehouseId: inventoryItem.warehouseId,
    timestamp: new Date()
  });

  // If status was low stock and is now in stock, emit recovery event
  if (previousStatus === 'LOW_STOCK' && inventoryItem.status === 'IN_STOCK') {
    req.io.emit('stock:recovered', {
      inventoryItem: inventoryItem,
      warehouseId: inventoryItem.warehouseId,
      message: `Stock recovered: ${inventoryItem.name} (${inventoryItem.sku})`,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Stock added successfully',
    data: {
      inventoryItem,
      quantityAdded: quantity
    }
  });
}));

// Remove stock from inventory item
router.post('/:id/remove-stock', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('quantity')
    .isNumeric()
    .withMessage('Quantity must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('reference')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Reference cannot be empty')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { quantity, reference } = req.body;

  const inventoryItem = await InventoryItem.findById(id);
  
  if (!inventoryItem) {
    throw new AppError('Inventory item not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Store previous status
  const previousStatus = inventoryItem.status;

  try {
    // Remove stock
    inventoryItem.removeStock(quantity, reference || `Manual removal by ${req.user.name}`);
    await inventoryItem.save();

    // Emit stock removed event
    req.io.emit('stock:removed', {
      inventoryItem,
      quantity,
      reference: reference || `Manual removal by ${req.user.name}`,
      removedBy: req.user.toPublicJSON(),
      warehouseId: inventoryItem.warehouseId,
      timestamp: new Date()
    });

    // 📡 inventory_update — may disable Book buttons for drivers
    req.io.emit('inventory_update', {
      inventoryId: inventoryItem._id,
      sku: inventoryItem.sku,
      name: inventoryItem.name,
      available: inventoryItem.getAvailableQuantity(),
      status: inventoryItem.status,
      marketplaceVisible: inventoryItem.marketplaceVisible,
      warehouseId: inventoryItem.warehouseId,
      timestamp: new Date()
    });

    // If status changed to low stock, emit alert
    if (previousStatus !== 'LOW_STOCK' && inventoryItem.status === 'LOW_STOCK') {
      req.io.emit('stock:low', {
        inventoryItem: inventoryItem,
        warehouseId: inventoryItem.warehouseId,
        message: `Low stock alert: ${inventoryItem.name} (${inventoryItem.sku}) - Available: ${inventoryItem.getAvailableQuantity()} ${inventoryItem.unit}`,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Stock removed successfully',
      data: {
        inventoryItem,
        quantityRemoved: quantity
      }
    });

  } catch (error) {
    throw new AppError(error.message, 400);
  }
}));

// Reserve stock
router.post('/:id/reserve', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('quantity')
    .isNumeric()
    .withMessage('Quantity must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('reference')
    .trim()
    .notEmpty()
    .withMessage('Reference is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { quantity, reference } = req.body;

  const inventoryItem = await InventoryItem.findById(id);
  
  if (!inventoryItem) {
    throw new AppError('Inventory item not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  try {
    // Reserve stock
    inventoryItem.reserveStock(quantity);
    await inventoryItem.save();

    res.json({
      success: true,
      message: 'Stock reserved successfully',
      data: {
        inventoryItem,
        quantityReserved: quantity,
        availableQuantity: inventoryItem.getAvailableQuantity()
      }
    });

  } catch (error) {
    throw new AppError(error.message, 400);
  }
}));

// Release reserved stock
router.post('/:id/release', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('quantity')
    .isNumeric()
    .withMessage('Quantity must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('reference')
    .trim()
    .notEmpty()
    .withMessage('Reference is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { quantity, reference } = req.body;

  const inventoryItem = await InventoryItem.findById(id);
  
  if (!inventoryItem) {
    throw new AppError('Inventory item not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  try {
    // Release reserved stock
    inventoryItem.releaseReservedStock(quantity);
    await inventoryItem.save();

    res.json({
      success: true,
      message: 'Reserved stock released successfully',
      data: {
        inventoryItem,
        quantityReleased: quantity,
        availableQuantity: inventoryItem.getAvailableQuantity()
      }
    });

  } catch (error) {
    throw new AppError(error.message, 400);
  }
}));

// Get inventory statistics for warehouse
router.get('/stats/warehouse', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), asyncHandler(async (req, res) => {
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

  const stats = await InventoryItem.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$currentQty', '$unitPrice'] } },
        totalQty: { $sum: '$currentQty' }
      }
    }
  ]);

  const categoryStats = await InventoryItem.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$currentQty', '$unitPrice'] } }
      }
    }
  ]);

  const totalItems = await InventoryItem.countDocuments(matchQuery);
  const lowStockItems = await InventoryItem.countDocuments({ ...matchQuery, status: 'LOW_STOCK' });
  const outOfStockItems = await InventoryItem.countDocuments({ ...matchQuery, status: 'OUT_OF_STOCK' });

  res.json({
    success: true,
    message: 'Inventory statistics retrieved successfully',
    data: {
      totalItems,
      lowStockItems,
      outOfStockItems,
      lowStockRate: totalItems > 0 ? ((lowStockItems / totalItems) * 100).toFixed(2) : 0,
      statusBreakdown: stats,
      categoryBreakdown: categoryStats
    }
  });
}));

// Get expiring items (within 30 days)
router.get('/expiring/warehouse', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), asyncHandler(async (req, res) => {
  const { warehouseId } = req.query;

  // Build query
  const query = {
    expiryDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // Within 30 days
    expiryDate: { $gte: new Date() } // Not already expired
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

  const expiringItems = await InventoryItem.find(query)
    .sort({ expiryDate: 1 })
    .limit(20);

  res.json({
    success: true,
    message: 'Expiring items retrieved successfully',
    data: { expiringItems }
  });
}));

// Toggle marketplace visibility (WAREHOUSE_MANAGER/ADMIN only)
router.patch('/:id/marketplace-visibility', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { marketplaceVisible } = req.body;

  const inventoryItem = await InventoryItem.findById(id);
  if (!inventoryItem) throw new AppError('Inventory item not found', 404);

  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== inventoryItem.warehouseId) {
    throw new AppError('Access denied.', 403);
  }

  inventoryItem.marketplaceVisible = !!marketplaceVisible;
  await inventoryItem.save();

  // 📡 Broadcast visibility change — drivers fade out / restore card
  req.io.emit('inventory_update', {
    inventoryId: inventoryItem._id,
    sku: inventoryItem.sku,
    name: inventoryItem.name,
    available: inventoryItem.getAvailableQuantity(),
    status: inventoryItem.status,
    marketplaceVisible: inventoryItem.marketplaceVisible,
    warehouseId: inventoryItem.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: `Marketplace visibility set to ${inventoryItem.marketplaceVisible}`,
    data: { inventoryItem }
  });
}));

module.exports = router;
