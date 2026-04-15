const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User.model');
const { verifyToken, authorizeRoles, generateToken } = require('../middleware/auth.middleware');
const { asyncHandler, AppError, validationError } = require('../middleware/error.middleware');

const router = express.Router();

// Register new user
router.post('/register', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .isIn(['GUARD', 'DRIVER', 'WAREHOUSE_MANAGER', 'AUTHORITY', 'ADMIN'])
    .withMessage('Invalid role'),
  
  body('warehouseId')
    .trim()
    .notEmpty()
    .withMessage('Warehouse ID is required'),
  
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { name, email, password, role, warehouseId, phone, shift_start, shift_end, language } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Create new user
  const user = new User({
    name,
    email,
    password,
    role,
    warehouseId,
    phone,
    shift_start,
    shift_end,
    language
  });

  await user.save();

  // Generate JWT token
  const token = generateToken(user._id);

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      token,
      user: user.toPublicJSON()
    }
  });
}));

// Login user
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { email, password } = req.body;

  // Find user by email (include password field)
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact administrator', 401);
  }

  // Compare password
  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate JWT token
  const token = generateToken(user._id);

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: user.toPublicJSON()
    }
  });
}));

// Get current user (protected route)
router.get('/me', verifyToken, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'User data retrieved successfully',
    data: {
      user: req.user.toPublicJSON()
    }
  });
}));

// Update user profile
router.route('/profile')
  .put(verifyToken, [
    body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  
    body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
  ])
  .patch(verifyToken, [
    body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
  ])
  .all(asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { name, phone, avatar, language, vehicle_plate, vehicle_type, capacity_tonnes, preferred_routes } = req.body;
  const userId = req.user._id;

  // Find and update user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update fields
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;
  if (language !== undefined) user.language = language;
  
  // Update driver fields
  if (vehicle_plate !== undefined) user.vehicle_plate = vehicle_plate;
  if (vehicle_type !== undefined) user.vehicle_type = vehicle_type;
  if (capacity_tonnes !== undefined) user.capacity_tonnes = capacity_tonnes;
  if (preferred_routes !== undefined) user.preferred_routes = preferred_routes;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: user.toPublicJSON()
    }
  });
}));

// Change password
router.put('/change-password', verifyToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  // Find user with password
  const user = await User.findById(userId).select('+password');
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  
  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Get all users (admin only)
router.get('/users', verifyToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, warehouseId, search } = req.query;
  
  // Build query
  const query = {};
  
  if (role) query.role = role;
  if (warehouseId) query.warehouseId = warehouseId;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-password');

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    message: 'Users retrieved successfully',
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// Update user status (admin only)
router.patch('/users/:userId/status', verifyToken, authorizeRoles('ADMIN'), [
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { userId } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(userId);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Prevent admin from deactivating themselves
  if (userId === req.user._id.toString() && !isActive) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user: user.toPublicJSON()
    }
  });
}));

// Update user role (admin only)
router.patch('/users/:userId/role', verifyToken, authorizeRoles('ADMIN'), [
  body('role')
    .isIn(['GUARD', 'DRIVER', 'WAREHOUSE_MANAGER', 'AUTHORITY', 'ADMIN'])
    .withMessage('Invalid role')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { userId } = req.params;
  const { role } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.role = role;
  await user.save();

  res.json({
    success: true,
    message: `User role updated successfully`,
    data: {
      user: user.toPublicJSON()
    }
  });
}));

// Logout user (client-side token removal)
router.post('/logout', verifyToken, asyncHandler(async (req, res) => {
  // In a real-world scenario, you might want to:
  // 1. Add the token to a blacklist (Redis)
  // 2. Or invalidate the token on the user side
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

module.exports = router;
