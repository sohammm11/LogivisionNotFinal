const mongoose = require('mongoose');
const crypto = require('crypto');

const itemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'tons', 'pcs', 'boxes', 'liters', 'meters']
  }
});

const challanSchema = new mongoose.Schema({
  challanId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  vehicleNo: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  itemsList: [itemSchema],
  totalWeight: {
    type: Number,
    required: true,
    min: 0
  },
  declaredLoad: {
    type: String,
    required: true,
    enum: ['FULL', 'HALF', 'EMPTY']
  },
  visualLoad: {
    type: String,
    required: true,
    enum: ['FULL', 'HALF', 'EMPTY']
  },
  destination: {
    type: String,
    required: true,
    trim: true
  },
  dockAssigned: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'VERIFIED', 'MISMATCH', 'FLAGGED'],
    default: 'PENDING'
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  warehouseId: {
    type: String,
    required: true,
    index: true
  },
  entryHash: {
    type: String,
    required: true,
    unique: true
  },
  gateDuration: {
    type: Number,
    default: 0 // in seconds
  },
  scannedAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  mismatchNotes: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  pickupAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  temperature: {
    type: Number // for temperature-sensitive cargo
  },
  humidity: {
    type: Number // for humidity-sensitive cargo
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currentLocation: {
    lat: Number,
    lng: Number
  },
  eta: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate unique challan ID and hash
challanSchema.pre('validate', function (next) {
  if (!this.isNew) return next();

  if (!this.challanId) {
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    this.challanId = `CLN-${year}-${random}`;
  }

  // Generate entry hash if not present
  if (!this.entryHash) {
    const hashData = `${this.vehicleNo}${Date.now()}${this.challanId}`;
    this.entryHash = crypto.createHash('sha256').update(hashData).digest('hex');
  }

  next();
});

// Update location for inbound tracking
challanSchema.methods.updateLocation = function (lat, lng, eta) {
  this.currentLocation = { lat, lng };
  if (eta) this.eta = new Date(eta);
  return this.save();
};

// Calculate gate duration
challanSchema.methods.calculateGateDuration = function () {
  if (this.scannedAt && this.verifiedAt) {
    this.gateDuration = Math.floor((this.verifiedAt - this.scannedAt) / 1000);
  }
  return this.gateDuration;
};

// Check for mismatch
challanSchema.methods.checkMismatch = function () {
  if (this.declaredLoad !== this.visualLoad) {
    this.status = 'MISMATCH';
    return true;
  }
  return false;
};

// Indexes for better query performance
challanSchema.index({ warehouseId: 1, scannedAt: -1 });
challanSchema.index({ vehicleNo: 1 });
challanSchema.index({ status: 1 });
challanSchema.index({ scannedBy: 1 });

module.exports = mongoose.model('Challan', challanSchema);
