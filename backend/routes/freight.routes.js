const express = require('express');
const { body, validationResult } = require('express-validator');
const FreightBooking = require('../models/FreightBooking.model');
const Truck = require('../models/Truck.model');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');
const { asyncHandler, AppError, validationError } = require('../middleware/error.middleware');

const router = express.Router();

// Get available trucks near coordinates
router.get('/available', verifyToken, asyncHandler(async (req, res) => {
  const { lat, lng, radius = 50, warehouseId } = req.query;

  // Latitude and longitude are optional now, defaults to showing all if missing
  // if (!lat || !lng) {
  //   throw new AppError('Latitude and longitude are required', 400);
  // }

  // Build query
  const query = {
    isAvailable: true,
    currentStatus: { $in: ['EN_ROUTE', 'AT_GATE', 'COMPLETED', 'LOADING', 'UNLOADING', 'AT_WAREHOUSE', 'IDLE'] },
    locationLat: { $exists: true },
    locationLng: { $exists: true }
  };

  // Filter by warehouse if specified
  if (warehouseId) {
    // Check warehouse access
    if (req.user.role !== 'ADMIN' && req.user.warehouseId !== warehouseId) {
      throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
    }
    query.assignedWarehouse = warehouseId;
  } else if (req.user.role !== 'ADMIN') {
    query.assignedWarehouse = req.user.warehouseId;
  }

  const trucks = await Truck.find(query).populate('driverId', 'name email phone');

  // Filter trucks within radius if lat/lng available
  let availableTrucks = trucks;
  if (lat && lng) {
    const nearby = trucks.filter(truck => {
      const distance = truck.getDistanceFrom(parseFloat(lat), parseFloat(lng));
      return distance <= parseFloat(radius);
    });

    // Fallback: If no trucks nearby, show all available trucks
    if (nearby.length > 0) {
      availableTrucks = nearby;
    }

    // Sort by distance
    availableTrucks.sort((a, b) => {
      const distanceA = a.getDistanceFrom(parseFloat(lat), parseFloat(lng));
      const distanceB = b.getDistanceFrom(parseFloat(lat), parseFloat(lng));
      return distanceA - distanceB;
    });
  }

  res.json({
    success: true,
    message: 'Available trucks retrieved successfully',
    data: {
      trucks: availableTrucks.map(truck => {
        const truckData = truck.toJSON();
        if (lat && lng) {
          truckData.distance = truck.getDistanceFrom(parseFloat(lat), parseFloat(lng));
        }
        return truckData;
      }),
      searchCenter: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      radius: parseFloat(radius)
    }
  });
}));

// Get current driver's truck
router.get('/my-truck', verifyToken, authorizeRoles('DRIVER'), asyncHandler(async (req, res) => {
  const truck = await Truck.findOne({ driverId: req.user._id });

  if (!truck) {
    throw new AppError('No truck assigned to this driver', 404);
  }

  res.json({
    success: true,
    message: 'Truck details retrieved successfully',
    data: {
      truck
    }
  });
}));

// Update truck market status (DRIVER only)
router.patch('/my-truck/market', verifyToken, authorizeRoles('DRIVER'), [
  body('currentLoadKg')
    .optional()
    .isNumeric()
    .withMessage('Current load must be a number')
    .isFloat({ min: 0 }),
  body('cargoPreferences')
    .optional()
    .isArray()
    .withMessage('Cargo preferences must be an array'),
  body('cargoDescription')
    .optional()
    .isString()
    .withMessage('Cargo description must be a string'),
  body('pricePerKm')
    .optional()
    .isNumeric()
    .withMessage('Price per km must be a number')
], asyncHandler(async (req, res) => {
  const { currentLoadKg, cargoPreferences, cargoDescription, pricePerKm } = req.body;
  const truck = await Truck.findOne({ driverId: req.user._id });

  if (!truck) {
    throw new AppError('No truck assigned to this driver', 404);
  }

  if (currentLoadKg !== undefined) {
    if (currentLoadKg > truck.totalCapacityKg) {
      throw new AppError('Current load cannot exceed total capacity', 400);
    }
    truck.currentLoadKg = currentLoadKg;
    truck.calculateAvailableCapacity();
  }

  if (cargoPreferences) truck.cargoPreferences = cargoPreferences;
  if (cargoDescription !== undefined) truck.cargoDescription = cargoDescription;
  if (pricePerKm !== undefined) truck.pricePerKm = pricePerKm;

  truck.lastMarketUpdate = new Date();
  await truck.save();

  res.json({
    success: true,
    message: 'Market status updated successfully',
    data: { truck }
  });
}));

// Update general truck details (DRIVER only)
router.patch('/my-truck', verifyToken, authorizeRoles('DRIVER'), [
  body('regNo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Registration number cannot be empty')
    .toUpperCase(),
  body('make')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Make cannot be empty'),
  body('model')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Model cannot be empty'),
  body('totalCapacityKg')
    .optional()
    .isNumeric()
    .withMessage('Total capacity must be a number')
    .isFloat({ min: 100 })
    .withMessage('Minimum capacity is 100kg'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Invalid year'),
  body('fuelType')
    .optional()
    .isIn(['DIESEL', 'PETROL', 'CNG', 'ELECTRIC'])
    .withMessage('Invalid fuel type')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const truck = await Truck.findOne({ driverId: req.user._id });

  if (!truck) {
    throw new AppError('No truck assigned to this driver', 404);
  }

  const allowedUpdates = ['regNo', 'make', 'model', 'totalCapacityKg', 'year', 'fuelType', 'truckType'];
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      truck[field] = req.body[field];
    }
  });

  if (req.body.totalCapacityKg !== undefined) {
    truck.calculateAvailableCapacity();
  }

  await truck.save();

  res.json({
    success: true,
    message: 'Vehicle information updated successfully',
    data: { truck }
  });
}));

// Get market statistics including monthly average rate (DRIVER only)
router.get('/market/stats', verifyToken, authorizeRoles('DRIVER'), asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stats = await FreightBooking.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        completedAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: null,
        avgRate: { $avg: '$pricePerKm' },
        totalBookings: { $sum: 1 }
      }
    }
  ]);

  const avgRate = stats.length > 0 ? Math.round(stats[0].avgRate) : 45;

  res.json({
    success: true,
    data: {
      averageMonthlyRate: avgRate,
      totalMarketBookings: stats.length > 0 ? stats[0].totalBookings : 0
    }
  });
}));

// Create new freight booking (WAREHOUSE_MANAGER only)
router.post('/bookings', verifyToken, authorizeRoles('WAREHOUSE_MANAGER'), [
  body('truckId')
    .notEmpty()
    .withMessage('Truck ID is required')
    .isMongoId()
    .withMessage('Invalid truck ID'),

  body('driverId')
    .notEmpty()
    .withMessage('Driver ID is required')
    .isMongoId()
    .withMessage('Invalid driver ID'),

  body('warehouseId')
    .trim()
    .notEmpty()
    .withMessage('Warehouse ID is required'),

  body('cargoDescription')
    .trim()
    .notEmpty()
    .withMessage('Cargo description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Cargo description must be between 10 and 500 characters'),

  body('weightKg')
    .isNumeric()
    .withMessage('Weight must be a number')
    .isFloat({ min: 0.1 })
    .withMessage('Weight must be greater than 0'),

  body('distanceKm')
    .isNumeric()
    .withMessage('Distance must be a number')
    .isFloat({ min: 0.1 })
    .withMessage('Distance must be greater than 0'),

  body('pricePerKm')
    .isNumeric()
    .withMessage('Price per km must be a number')
    .isFloat({ min: 0 })
    .withMessage('Price per km must be positive'),

  body('pickupAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Pickup street address is required'),

  body('pickupAddress.city')
    .trim()
    .notEmpty()
    .withMessage('Pickup city is required'),

  body('pickupAddress.state')
    .trim()
    .notEmpty()
    .withMessage('Pickup state is required'),

  body('pickupAddress.pincode')
    .trim()
    .notEmpty()
    .withMessage('Pickup pincode is required'),

  body('deliveryAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Delivery street address is required'),

  body('deliveryAddress.city')
    .trim()
    .notEmpty()
    .withMessage('Delivery city is required'),

  body('deliveryAddress.state')
    .trim()
    .notEmpty()
    .withMessage('Delivery state is required'),

  body('deliveryAddress.pincode')
    .trim()
    .notEmpty()
    .withMessage('Delivery pincode is required'),

  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Invalid priority'),

  body('cargoType')
    .optional()
    .isIn(['GENERAL', 'PERISHABLE', 'HAZMAT', 'FRAGILE', 'OVERSIZED', 'TEMPERATURE_CONTROLLED'])
    .withMessage('Invalid cargo type')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const bookingData = {
    ...req.body,
    createdBy: req.user._id
  };

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== bookingData.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  // Verify truck exists and is available
  const truck = await Truck.findById(bookingData.truckId);
  if (!truck) {
    throw new AppError('Truck not found', 404);
  }

  if (!truck.isAvailable) {
    throw new AppError('Truck is not available for booking', 400);
  }

  // Check if truck can carry the weight
  const availableWeight = truck.totalCapacityKg - truck.currentLoadKg;
  if (!truck.canCarryLoad(bookingData.weightKg)) {
    throw new AppError(`Truck capacity exceeded. Available: ${availableWeight}kg, Required: ${bookingData.weightKg}kg`, 400);
  }

  // Calculate total cost
  const totalCost = bookingData.distanceKm * bookingData.pricePerKm;
  bookingData.totalCost = totalCost;

  // Create booking
  const booking = new FreightBooking(bookingData);
  await booking.save();

  // Update truck status
  truck.currentStatus = 'AT_GATE';
  truck.assignedWarehouse = bookingData.warehouseId;
  truck.currentDestination = `${bookingData.deliveryAddress.city}, ${bookingData.deliveryAddress.state}`;
  await truck.save();

  // Emit freight available event
  req.io.emit('freight:available', {
    booking: await FreightBooking.findById(booking._id)
      .populate('truckId', 'regNo make model totalCapacityKg')
      .populate('driverId', 'name email phone')
      .populate('createdBy', 'name email'),
    warehouseId: bookingData.warehouseId,
    timestamp: new Date()
  });

  res.status(201).json({
    success: true,
    message: 'Freight booking created successfully',
    data: {
      booking: await FreightBooking.findById(booking._id)
        .populate('truckId', 'regNo make model totalCapacityKg')
        .populate('driverId', 'name email phone')
        .populate('createdBy', 'name email')
    }
  });
}));

// Accept booking (DRIVER only)
router.patch('/bookings/:id/accept', verifyToken, authorizeRoles('DRIVER'), [
  body('estimatedArrivalTime')
    .optional()
    .isISO8601()
    .withMessage('Estimated arrival time must be a valid date')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Estimated arrival time must be in the future');
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
  const { estimatedArrivalTime } = req.body;

  const booking = await FreightBooking.findById(id);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check if driver is assigned to this booking
  if (booking.driverId.toString() !== req.user._id.toString()) {
    throw new AppError('You are not assigned to this booking', 403);
  }

  if (booking.status !== 'PENDING') {
    throw new AppError('Booking cannot be accepted in current status', 400);
  }

  // Accept booking
  booking.acceptBooking();
  if (estimatedArrivalTime) {
    booking.estimatedArrivalTime = new Date(estimatedArrivalTime);
  }
  await booking.save();

  // Update truck status
  const truck = await Truck.findById(booking.truckId);
  if (truck) {
    truck.currentStatus = 'EN_ROUTE';
    await truck.save();
  }

  // Emit booking accepted event to both driver and warehouse
  const bookingData = await FreightBooking.findById(booking._id)
    .populate('truckId', 'regNo make model')
    .populate('driverId', 'name email phone')
    .populate('createdBy', 'name email');

  req.io.emit('booking:accepted', {
    booking: bookingData,
    warehouseId: booking.warehouseId,
    timestamp: new Date()
  });

  // Send to driver's personal room
  req.io.to(`driver_${booking.driverId}`).emit('booking:accepted:personal', {
    booking: bookingData,
    message: 'Booking accepted successfully',
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Booking accepted successfully',
    data: {
      booking: bookingData
    }
  });
}));

// Get bookings filtered by driver or warehouse
router.get('/bookings', verifyToken, asyncHandler(async (req, res) => {
  const {
    driverId,
    warehouseId,
    status,
    page = 1,
    limit = 10,
    startDate,
    endDate,
    priority
  } = req.query;

  // Build query
  const query = {};

  // Filter based on user role
  if (req.user.role === 'DRIVER') {
    query.driverId = req.user._id;
  } else if (req.user.role === 'WAREHOUSE_MANAGER') {
    query.warehouseId = req.user.warehouseId;
  } else if (req.user.role === 'ADMIN') {
    if (driverId) query.driverId = driverId;
    if (warehouseId) query.warehouseId = warehouseId;
  }

  if (status) query.status = status;
  if (priority) query.priority = priority;

  if (startDate || endDate) {
    query.bookedAt = {};
    if (startDate) query.bookedAt.$gte = new Date(startDate);
    if (endDate) query.bookedAt.$lte = new Date(endDate);
  }

  const bookings = await FreightBooking.find(query)
    .populate('truckId', 'regNo make model totalCapacityKg')
    .populate('driverId', 'name email phone')
    .populate('createdBy', 'name email')
    .sort({ bookedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await FreightBooking.countDocuments(query);

  res.json({
    success: true,
    message: 'Bookings retrieved successfully',
    data: {
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Get single booking by ID
router.get('/bookings/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await FreightBooking.findById(id)
    .populate('truckId', 'regNo make model totalCapacityKg locationLat locationLng')
    .populate('driverId', 'name email phone')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check access based on role
  if (req.user.role === 'DRIVER' && booking.driverId.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403);
  }

  if (req.user.role === 'WAREHOUSE_MANAGER' && booking.warehouseId !== req.user.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  res.json({
    success: true,
    message: 'Booking retrieved successfully',
    data: {
      booking
    }
  });
}));

// Update booking location (DRIVER only)
router.patch('/bookings/:id/location', verifyToken, authorizeRoles('DRIVER'), [
  body('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  body('status')
    .optional()
    .isIn(['UPDATE', 'CHECKPOINT', 'DELAY', 'ISSUE'])
    .withMessage('Invalid status'),

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
  const { lat, lng, status, notes } = req.body;

  const booking = await FreightBooking.findById(id);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check if driver is assigned to this booking
  if (booking.driverId.toString() !== req.user._id.toString()) {
    throw new AppError('You are not assigned to this booking', 403);
  }

  // Update location
  booking.updateLocation(parseFloat(lat), parseFloat(lng), status, notes);
  await booking.save();

  // Update truck location
  const truck = await Truck.findById(booking.truckId);
  if (truck) {
    truck.updateLocation(parseFloat(lat), parseFloat(lng));
    await truck.save();
  }

  // Emit location update event
  req.io.emit('booking:location:updated', {
    bookingId: booking._id,
    location: { lat: parseFloat(lat), lng: parseFloat(lng) },
    status: status || 'UPDATE',
    notes: notes || '',
    driverId: req.user._id,
    warehouseId: booking.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      status: status || 'UPDATE',
      notes: notes || ''
    }
  });
}));

// Complete booking (DRIVER only)
router.patch('/bookings/:id/complete', verifyToken, authorizeRoles('DRIVER'), [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),

  body('actualDuration')
    .optional()
    .isNumeric()
    .withMessage('Actual duration must be a number')
    .isFloat({ min: 0 })
    .withMessage('Actual duration must be positive')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { notes, actualDuration } = req.body;

  const booking = await FreightBooking.findById(id);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check if driver is assigned to this booking
  if (booking.driverId.toString() !== req.user._id.toString()) {
    throw new AppError('You are not assigned to this booking', 403);
  }

  if (booking.status !== 'IN_TRANSIT') {
    throw new AppError('Booking must be in transit to be completed', 400);
  }

  // Complete booking
  booking.completeBooking();
  if (notes) booking.notes = notes;
  if (actualDuration) booking.actualDuration = actualDuration;
  await booking.save();

  // Update truck status
  const truck = await Truck.findById(booking.truckId);
  if (truck) {
    truck.currentStatus = 'COMPLETED';
    truck.isAvailable = true;
    truck.currentDestination = null;
    truck.tripsCompleted += 1;
    await truck.save();
  }

  // Emit booking completed event
  const bookingData = await FreightBooking.findById(booking._id)
    .populate('truckId', 'regNo make model')
    .populate('driverId', 'name email phone');

  req.io.emit('booking:completed', {
    booking: bookingData,
    warehouseId: booking.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Booking completed successfully',
    data: {
      booking: bookingData
    }
  });
}));

// Cancel booking (WAREHOUSE_MANAGER/ADMIN only)
router.patch('/bookings/:id/cancel', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Cancellation reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { reason } = req.body;

  const booking = await FreightBooking.findById(id);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check warehouse access
  if (req.user.role !== 'ADMIN' && req.user.warehouseId !== booking.warehouseId) {
    throw new AppError('Access denied. You can only access your assigned warehouse.', 403);
  }

  if (booking.status === 'COMPLETED') {
    throw new AppError('Cannot cancel completed booking', 400);
  }

  // Cancel booking
  booking.cancelBooking(reason);
  booking.updatedBy = req.user._id;
  await booking.save();

  // Update truck status
  const truck = await Truck.findById(booking.truckId);
  if (truck) {
    truck.currentStatus = 'EN_ROUTE';
    truck.isAvailable = true;
    truck.assignedWarehouse = null;
    truck.currentDestination = null;
    await truck.save();
  }

  // Emit booking cancelled event
  const bookingData = await FreightBooking.findById(booking._id)
    .populate('truckId', 'regNo make model')
    .populate('driverId', 'name email phone');

  req.io.emit('booking:cancelled', {
    booking: bookingData,
    cancelledBy: req.user.toPublicJSON(),
    warehouseId: booking.warehouseId,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking: bookingData
    }
  });
}));

// Get freight statistics for warehouse
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
    matchQuery.bookedAt = {};
    if (startDate) matchQuery.bookedAt.$gte = new Date(startDate);
    if (endDate) matchQuery.bookedAt.$lte = new Date(endDate);
  }

  const stats = await FreightBooking.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalCost' },
        avgCost: { $avg: '$totalCost' },
        totalDistance: { $sum: '$distanceKm' },
        avgDistance: { $avg: '$distanceKm' }
      }
    }
  ]);

  const totalBookings = await FreightBooking.countDocuments(matchQuery);
  const completedBookings = await FreightBooking.countDocuments({ ...matchQuery, status: 'COMPLETED' });
  const totalRevenue = await FreightBooking.aggregate([
    { $match: { ...matchQuery, status: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$totalCost' } } }
  ]);

  res.json({
    success: true,
    message: 'Freight statistics retrieved successfully',
    data: {
      totalBookings,
      completedBookings,
      completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(2) : 0,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      statusBreakdown: stats
    }
  });
}));

module.exports = router;
