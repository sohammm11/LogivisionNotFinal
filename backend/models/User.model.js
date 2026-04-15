const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['GUARD', 'DRIVER', 'WAREHOUSE_MANAGER', 'AUTHORITY', 'ADMIN'],
    default: 'GUARD'
  },
  warehouseId: {
    type: String,
    required: [true, 'Warehouse ID is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String
  },
  shift_start: {
    type: String,
    trim: true
  },
  shift_end: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    enum: ['en', 'hi', 'mr'],
    default: 'en'
  },
  // Driver specific fields
  vehicle_plate: {
    type: String,
    trim: true
  },
  vehicle_type: {
    type: String,
    enum: ['Mini Truck', 'Medium Truck', 'Heavy Truck', 'Trailer'],
    default: 'Medium Truck'
  },
  capacity_tonnes: {
    type: Number,
    default: 0
  },
  preferred_routes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile
userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    warehouseId: this.warehouseId,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    phone: this.phone,
    avatar: this.avatar,
    shift_start: this.shift_start,
    shift_end: this.shift_end,
    language: this.language,
    vehicle_plate: this.vehicle_plate,
    vehicle_type: this.vehicle_type,
    capacity_tonnes: this.capacity_tonnes,
    preferred_routes: this.preferred_routes,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
