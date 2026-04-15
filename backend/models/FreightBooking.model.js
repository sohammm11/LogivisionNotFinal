const mongoose = require('mongoose');

const freightBookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  truckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  warehouseId: {
    type: String,
    required: true
  },
  cargoDescription: {
    type: String,
    required: true,
    trim: true
  },
  weightKg: {
    type: Number,
    required: true,
    min: 0
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerKm: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING'
  },
  bookedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
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
  estimatedDuration: {
    type: Number // in hours
  },
  actualDuration: {
    type: Number // in hours
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  cargoType: {
    type: String,
    enum: ['GENERAL', 'PERISHABLE', 'HAZMAT', 'FRAGILE', 'OVERSIZED', 'TEMPERATURE_CONTROLLED'],
    default: 'GENERAL'
  },
  specialRequirements: [{
    type: String,
    enum: ['LIFT_GATE', 'TARP', 'REEFER', 'STRAPS', 'DOLLY', ' pallet_jack']
  }],
  insuranceRequired: {
    type: Boolean,
    default: false
  },
  insuranceAmount: {
    type: Number,
    default: 0
  },
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['CHALLAN', 'INVOICE', 'INSURANCE', 'PERMIT', 'OTHER']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tracking: {
    currentLocation: {
      lat: Number,
      lng: Number
    },
    lastUpdate: Date,
    checkpoints: [{
      location: {
        lat: Number,
        lng: Number
      },
      timestamp: Date,
      status: String,
      notes: String
    }]
  },
  payment: {
    method: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'UPI', 'CREDIT_CARD'],
      default: 'BANK_TRANSFER'
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE'],
      default: 'PENDING'
    },
    amountPaid: {
      type: Number,
      default: 0
    },
    dueDate: Date,
    paidAt: Date,
    transactionId: String
  },
  rating: {
    driverRating: {
      type: Number,
      min: 1,
      max: 5
    },
    serviceRating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedAt: Date
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Generate unique booking ID
freightBookingSchema.pre('validate', async function (next) {
  if (!this.isNew || this.bookingId) return next();

  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  this.bookingId = `FB-${year}${month}-${random}`;

  next();
});

// Calculate total cost
freightBookingSchema.methods.calculateTotalCost = function () {
  this.totalCost = this.distanceKm * this.pricePerKm;
  return this.totalCost;
};

// Accept booking
freightBookingSchema.methods.acceptBooking = function () {
  this.status = 'ACCEPTED';
  this.acceptedAt = new Date();
};

// Start transit
freightBookingSchema.methods.startTransit = function () {
  this.status = 'IN_TRANSIT';
};

// Complete booking
freightBookingSchema.methods.completeBooking = function () {
  this.status = 'COMPLETED';
  this.completedAt = new Date();

  if (this.bookedAt) {
    const durationMs = this.completedAt - this.bookedAt;
    this.actualDuration = durationMs / (1000 * 60 * 60); // Convert to hours
  }
};

// Cancel booking
freightBookingSchema.methods.cancelBooking = function (reason) {
  this.status = 'CANCELLED';
  this.notes = reason || this.notes;
};

// Update location and recalculate ETA
freightBookingSchema.methods.updateLocation = function (lat, lng, status, notes) {
  this.tracking.currentLocation = { lat, lng };
  this.tracking.lastUpdate = new Date();

  // Recalculate ETA if we have delivery coordinates
  if (this.deliveryAddress?.coordinates?.lat) {
    const R = 6371; // km
    const dLat = (this.deliveryAddress.coordinates.lat - lat) * Math.PI / 180;
    const dLon = (this.deliveryAddress.coordinates.lng - lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * Math.PI / 180) * Math.cos(this.deliveryAddress.coordinates.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distRemaining = R * c;

    // Average speed 50km/h
    const hoursRemaining = distRemaining / 50;
    this.estimatedArrivalTime = new Date(Date.now() + hoursRemaining * 3600000);
  }

  if (status || notes) {
    this.tracking.checkpoints.push({
      location: { lat, lng },
      timestamp: new Date(),
      status: status || 'UPDATE',
      notes: notes || ''
    });
  }
};

// Add checkpoint
freightBookingSchema.methods.addCheckpoint = function (lat, lng, status, notes) {
  this.tracking.checkpoints.push({
    location: { lat, lng },
    timestamp: new Date(),
    status: status,
    notes: notes || ''
  });

  this.tracking.currentLocation = { lat, lng };
  this.tracking.lastUpdate = new Date();
};

// Calculate estimated duration based on distance
freightBookingSchema.methods.calculateEstimatedDuration = function () {
  // Assuming average speed of 40 km/h for city driving and 60 km/h for highway
  const avgSpeed = this.distanceKm < 50 ? 40 : 60;
  this.estimatedDuration = this.distanceKm / avgSpeed;
  return this.estimatedDuration;
};

// Check if payment is overdue
freightBookingSchema.methods.isPaymentOverdue = function () {
  if (this.payment.status === 'PAID') return false;
  if (!this.payment.dueDate) return false;

  return new Date() > this.payment.dueDate;
};

// Get outstanding amount
freightBookingSchema.methods.getOutstandingAmount = function () {
  return this.totalCost - this.payment.amountPaid;
};

// Indexes for better query performance
freightBookingSchema.index({ truckId: 1 });
freightBookingSchema.index({ driverId: 1 });
freightBookingSchema.index({ warehouseId: 1 });
freightBookingSchema.index({ status: 1 });
freightBookingSchema.index({ bookedAt: -1 });
freightBookingSchema.index({ 'payment.status': 1 });

module.exports = mongoose.model('FreightBooking', freightBookingSchema);
