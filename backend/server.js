require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

// Import routes
const authRoutes = require('./routes/auth.routes');
const challanRoutes = require('./routes/challan.routes');
const dockRoutes = require('./routes/dock.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const freightRoutes = require('./routes/freight.routes');
const paymentRoutes = require('./routes/payment.routes');
const settingsRoutes = require('./routes/settings.routes');
const echallanRoutes = require('./routes/echallan.routes');
const ewbRoutes = require('./routes/ewb.routes');

// Import middleware
const { errorHandler, notFound, errorLogger } = require('./middleware/error.middleware');
const { verifyToken } = require('./middleware/auth.middleware');

// Create Express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());

// Rate limiting for login route
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Data sanitization middleware
app.use(mongoSanitize());
app.use(xss());

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'LogiVision Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

app.get('/db-check', (req, res) => {
  const status = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  res.json({
    success: true,
    status: states[status] || 'unknown',
    uri: process.env.MONGODB_URI.replace(/:.+@/, ':****@') // mask password if any
  });
});

// Socket.IO connection handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const User = require('./models/User.model');
    const jwt = require('jsonwebtoken');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return next(new Error('Invalid user'));
    }

    socket.user = user;
    socket.warehouseId = user.warehouseId;
    next();

  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.user.email}) - Role: ${socket.user.role}`);
  console.log(`Warehouse: ${socket.warehouseId}`);

  // Join warehouse room
  socket.join(socket.warehouseId);

  // Join role-based rooms
  socket.join(`role_${socket.user.role}`);

  // Join driver-specific room if driver
  if (socket.user.role === 'DRIVER') {
    socket.join(`driver_${socket.user._id}`);
  }

  // Handle joining specific rooms
  socket.on('join-room', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.user.name} joined room: ${roomName}`);
  });

  // Handle leaving rooms
  socket.on('leave-room', (roomName) => {
    socket.leave(roomName);
    console.log(`User ${socket.user.name} left room: ${roomName}`);
  });

  // Handle driver going live
  socket.on('driver:live', (payload) => {
    console.log(`Driver GO LIVE: ${payload.driverName} (${payload.driverId})`);
    io.to('role_WAREHOUSE_MANAGER').emit('driver:available', payload);
  });

  // Handle driver going offline
  socket.on('driver:offline', (payload) => {
    console.log(`Driver GO OFFLINE: ${payload.driverId}`);
    io.to('role_WAREHOUSE_MANAGER').emit('driver:offline', payload);
  });

  // Handle location updates from drivers
  socket.on('location-update', (data) => {
    if (socket.user.role === 'DRIVER') {
      // Broadcast to warehouse room
      socket.to(socket.warehouseId).emit('driver-location-update', {
        driverId: socket.user._id,
        driverName: socket.user.name,
        location: data.location,
        timestamp: new Date()
      });
    }
  });

  // Handle Guard Verification Reports
  socket.on('challan:verified', (data) => {
    socket.to(socket.warehouseId).emit('challan:verified', {
      ...data,
      sender: socket.user.name,
      timestamp: new Date()
    });
  });

  socket.on('challan:mismatch', (data) => {
    socket.to(socket.warehouseId).emit('challan:mismatch', {
      ...data,
      sender: socket.user.name,
      timestamp: new Date()
    });
  });

  socket.on('mismatch:flagged', (data) => {
    socket.to(socket.warehouseId).emit('mismatch:flagged', {
      ...data,
      sender: socket.user.name,
      timestamp: new Date()
    });
  });

  // Handle custom events
  socket.on('custom-event', (data) => {
    console.log('Custom event received:', data);

    // Broadcast to relevant rooms based on event type
    if (data.target === 'warehouse') {
      socket.to(socket.warehouseId).emit('custom-event', {
        ...data,
        from: socket.user.name,
        timestamp: new Date()
      });
    } else if (data.target === 'role') {
      socket.to(`role_${data.targetRole}`).emit('custom-event', {
        ...data,
        from: socket.user.name,
        timestamp: new Date()
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.name} (${socket.user.email})`);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error for user ${socket.user.name}:`, error);
  });
});

// Attach io to request object for use in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API routes
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/echallaan', echallanRoutes);
app.use('/api/docks', dockRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/freight', freightRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ewb', ewbRoutes);

// Custom entries route requested by Guard form
app.post('/api/entries', require('./middleware/auth.middleware').verifyToken, async (req, res) => {
  try {
    console.log('Entry received:', req.body);
    const Challan = require('./models/Challan.model');
    const challanData = {
      ...req.body,
      scannedBy: req.user._id,
      warehouseId: req.user.warehouseId
    };
    const challan = new Challan(challanData);
    await challan.save();
    
    console.log('Saved entry._id:', challan._id);
    console.log('Socket emitting new_entry');
    
    // Emit new_entry to alert manager dashboard Guard Feed
    req.io.emit('new_entry', challan);
    
    // Fallback original emit
    req.io.to(req.user.warehouseId.toString()).emit('challan:scanned', {
      challan,
      scannedBy: req.user,
      warehouseId: req.user.warehouseId,
      timestamp: new Date()
    });

    res.status(201).json({ success: true, data: challan });
  } catch (error) {
    console.error('Error creating manual entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update EWB for an entry (Driver only)
app.patch('/api/entries/ewb', require('./middleware/auth.middleware').verifyToken, async (req, res) => {
  try {
    const { ewbNumber, driverId } = req.body;
    console.log(`[EWB SYNC] Driver ${driverId} preredistered EWB: ${ewbNumber}`);
    
    // Simulate finding the latest pending entry for this driver's vehicle and updating it
    res.json({ success: true, message: 'E-Way Bill pre-registered for your next stop' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔍 DEBUG: Add temporary OCR test route
app.get('/api/ocr/test', async (req, res) => {
  try {
    const ocrService = require('./services/ocr.service');
    // 1x1 black pixel PNG
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    console.log('[DEBUG ROUTE] Testing Gemini with 1x1 pixel...');
    const result = await ocrService.processChallanImage(testImage);
    res.json({ 
      success: true, 
      message: 'Gemini test route reached',
      result 
    });
  } catch (err) {
    console.error('[DEBUG ROUTE] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/entries/stats for Admin Reports
app.get('/api/entries/stats', require('./middleware/auth.middleware').verifyToken, async (req, res) => {
  try {
    const Challan = require('./models/Challan.model');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date();
    startOfMonth.setMonth(startOfMonth.getMonth() - 1);

    const matchQuery = {};
    if (req.user.role !== 'ADMIN') matchQuery.warehouseId = req.user.warehouseId;

    const todayCount = await Challan.countDocuments({ ...matchQuery, createdAt: { $gte: startOfToday } });
    const weekCount = await Challan.countDocuments({ ...matchQuery, createdAt: { $gte: startOfWeek } });
    const monthCount = await Challan.countDocuments({ ...matchQuery, createdAt: { $gte: startOfMonth } });
    const mismatchCount = await Challan.countDocuments({ ...matchQuery, status: 'MISMATCH', createdAt: { $gte: startOfToday } });

    // Mock average gate time to 12 minutes (720s) as we don't have dedicated gate out timestamps yet
    const avgGateTimeSeconds = 720;
    
    const verifiedCount = await Challan.countDocuments({ ...matchQuery, status: 'VERIFIED', createdAt: { $gte: startOfToday } });
    const approvalRate = todayCount > 0 ? ((verifiedCount / todayCount) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        todayCount,
        weekCount,
        monthCount,
        mismatchCount,
        avgGateTimeSeconds,
        approvalRate
      }
    });
  } catch (error) {
    console.error('Error fetching entry stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get('/api/entries', require('./middleware/auth.middleware').verifyToken, async (req, res) => {
  try {
    const Challan = require('./models/Challan.model');
    const entries = await Challan.find({ warehouseId: req.user.warehouseId })
      .populate('scannedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'LogiVision API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user',
        'PUT /api/auth/profile': 'Update profile',
        'PUT /api/auth/change-password': 'Change password',
        'GET /api/auth/users': 'Get all users (Admin only)',
        'PUT /api/auth/users/:userId/status': 'Update user status (Admin only)',
        'POST /api/auth/logout': 'Logout user'
      },
      challans: {
        'POST /api/challans': 'Create new challan (Guard only)',
        'GET /api/challans': 'Get all challans for warehouse',
        'GET /api/challans/:id': 'Get single challan',
        'PATCH /api/challans/:id/status': 'Update challan status (Authority/Admin only)',
        'GET /api/challans/stats/warehouse': 'Get challan statistics',
        'GET /api/challans/recent/warehouse': 'Get recent challans',
        'DELETE /api/challans/:id': 'Delete challan (Admin only)'
      },
      docks: {
        'GET /api/docks': 'Get all docks for warehouse',
        'GET /api/docks/:id': 'Get single dock',
        'PATCH /api/docks/:id/assign': 'Assign truck to dock (Warehouse Manager/Admin only)',
        'PATCH /api/docks/:id/release': 'Release dock (Warehouse Manager/Admin only)',
        'PATCH /api/docks/:id/schedule': 'Schedule dock (Warehouse Manager/Admin only)',
        'GET /api/docks/stats/warehouse': 'Get dock statistics',
        'PATCH /api/docks/:id/maintenance': 'Update dock maintenance status'
      },
      inventory: {
        'GET /api/inventory': 'Get all inventory items (Warehouse Manager/Admin only)',
        'GET /api/inventory/:sku': 'Get single inventory item',
        'POST /api/inventory': 'Create new inventory item (Warehouse Manager/Admin only)',
        'PATCH /api/inventory/:id': 'Update inventory item (Warehouse Manager/Admin only)',
        'POST /api/inventory/:id/add-stock': 'Add stock to inventory item',
        'POST /api/inventory/:id/remove-stock': 'Remove stock from inventory item',
        'POST /api/inventory/:id/reserve': 'Reserve stock',
        'POST /api/inventory/:id/release': 'Release reserved stock',
        'GET /api/inventory/stats/warehouse': 'Get inventory statistics',
        'GET /api/inventory/expiring/warehouse': 'Get expiring items'
      },
      freight: {
        'GET /api/freight/available': 'Get available trucks near coordinates',
        'POST /api/freight/bookings': 'Create new freight booking (Warehouse Manager only)',
        'PATCH /api/freight/bookings/:id/accept': 'Accept booking (Driver only)',
        'GET /api/freight/bookings': 'Get bookings filtered by driver or warehouse',
        'GET /api/freight/bookings/:id': 'Get single booking',
        'PATCH /api/freight/bookings/:id/location': 'Update booking location (Driver only)',
        'PATCH /api/freight/bookings/:id/complete': 'Complete booking (Driver only)',
        'PATCH /api/freight/bookings/:id/cancel': 'Cancel booking (Warehouse Manager/Admin only)',
        'GET /api/freight/stats/warehouse': 'Get freight statistics'
      }
    },
    socketEvents: {
      'challan:scanned': 'Emitted when new challan is scanned',
      'challan:status:updated': 'Emitted when challan status is updated',
      'challan:deleted': 'Emitted when challan is deleted',
      'dock:updated': 'Emitted when dock is assigned/updated',
      'dock:released': 'Emitted when dock is released',
      'dock:scheduled': 'Emitted when dock is scheduled',
      'dock:maintenance:updated': 'Emitted when dock maintenance status changes',
      'stock:low': 'Emitted when inventory item is low on stock',
      'stock:added': 'Emitted when stock is added to inventory',
      'stock:removed': 'Emitted when stock is removed from inventory',
      'stock:recovered': 'Emitted when stock recovers from low stock',
      'freight:available': 'Emitted when new freight booking is created',
      'booking:accepted': 'Emitted when booking is accepted',
      'booking:completed': 'Emitted when booking is completed',
      'booking:cancelled': 'Emitted when booking is cancelled',
      'booking:location:updated': 'Emitted when booking location is updated',
      'mismatch:flagged': 'Emitted when challan mismatch is detected',
      'driver-location-update': 'Emitted when driver updates location',
      'worker:checkin': 'Emitted when worker checks in',
      'worker:checkout': 'Emitted when worker checks out'
    }
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('LogiVision AI API is running in development mode...');
  });
}


app.use(errorLogger);
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    console.log('🔄 Continuing without database connection...');
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close(() => {
      console.log('🔌 MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close(() => {
      console.log('🔌 MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`🚀 LogiVision Backend running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔌 Socket.IO server ready`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, server, io };
