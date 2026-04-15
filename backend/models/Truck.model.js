const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalCapacityKg: {
    type: Number,
    required: true,
    min: 0
  },
  currentLoadKg: {
    type: Number,
    default: 0,
    min: 0
  },
  availableCapacityPercent: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  locationLat: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  locationLng: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentStatus: {
    type: String,
    required: true,
    enum: ['EN_ROUTE', 'AT_GATE', 'IN_YARD', 'LOADING', 'UNLOADING', 'COMPLETED', 'MAINTENANCE'],
    default: 'EN_ROUTE'
  },
  truckType: {
    type: String,
    required: true,
    enum: ['FLATBED', 'CONTAINER', 'REEFER', 'TANKER', 'BOX_TRUCK', 'PICKUP'],
    default: 'BOX_TRUCK'
  },
  make: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  insuranceExpiry: {
    type: Date
  },
  fitnessExpiry: {
    type: Date
  },
  lastServiceDate: {
    type: Date
  },
  nextServiceDate: {
    type: Date
  },
  fuelType: {
    type: String,
    enum: ['DIESEL', 'PETROL', 'CNG', 'ELECTRIC'],
    default: 'DIESEL'
  },
  averageKmPerLiter: {
    type: Number,
    default: 0
  },
  currentFuelLevel: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  odometerReading: {
    type: Number,
    default: 0
  },
  assignedWarehouse: {
    type: String,
    trim: true
  },
  currentDestination: {
    type: String,
    trim: true
  },
  estimatedArrivalTime: {
    type: Date
  },
  documents: {
    registrationCertificate: {
      number: String,
      expiry: Date,
      imageUrl: String
    },
    insurance: {
      policyNumber: String,
      expiry: Date,
      imageUrl: String
    },
    pollutionCertificate: {
      number: String,
      expiry: Date,
      imageUrl: String
    }
  },
  maintenanceHistory: [{
    date: Date,
    type: String,
    cost: Number,
    description: String,
    odometerReading: Number
  }],
  tripsCompleted: {
    type: Number,
    default: 0
  },
  totalDistanceKm: {
    type: Number,
    default: 0
  },
  cargoPreferences: {
    type: [String],
    default: ['GENERAL']
  },
  cargoDescription: {
    type: String,
    trim: true,
    default: ''
  },
  pricePerKm: {
    type: Number,
    default: 45,
    min: 0
  },
  lastMarketUpdate: {
    type: Date,
    default: Date.now
  },
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate available capacity percentage
truckSchema.methods.calculateAvailableCapacity = function () {
  if (this.totalCapacityKg === 0) return 100;

  const usedCapacity = (this.currentLoadKg / this.totalCapacityKg) * 100;
  this.availableCapacityPercent = Math.max(0, 100 - usedCapacity);

  return this.availableCapacityPercent;
};

// Update truck location
truckSchema.methods.updateLocation = function (lat, lng) {
  this.locationLat = lat;
  this.locationLng = lng;
  this.lastLocationUpdate = new Date();
};

// Check if truck can carry additional load
truckSchema.methods.canCarryLoad = function (additionalWeightKg) {
  return (this.currentLoadKg + additionalWeightKg) <= this.totalCapacityKg;
};

// Add load to truck
truckSchema.methods.addLoad = function (weightKg) {
  if (!this.canCarryLoad(weightKg)) {
    throw new Error('Insufficient capacity');
  }
  this.currentLoadKg += weightKg;
  this.calculateAvailableCapacity();
};

// Remove load from truck
truckSchema.methods.removeLoad = function (weightKg) {
  this.currentLoadKg = Math.max(0, this.currentLoadKg - weightKg);
  this.calculateAvailableCapacity();
};

// Check if documents are valid
truckSchema.methods.areDocumentsValid = function () {
  const now = new Date();

  if (this.insuranceExpiry && this.insuranceExpiry < now) return false;
  if (this.fitnessExpiry && this.fitnessExpiry < now) return false;
  if (this.documents.registrationCertificate.expiry && this.documents.registrationCertificate.expiry < now) return false;
  if (this.documents.insurance.expiry && this.documents.insurance.expiry < now) return false;
  if (this.documents.pollutionCertificate.expiry && this.documents.pollutionCertificate.expiry < now) return false;

  return true;
};

// Get distance from coordinates (Haversine formula)
truckSchema.methods.getDistanceFrom = function (lat, lng) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat - this.locationLat) * Math.PI / 180;
  const dLng = (lng - this.locationLng) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.locationLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Indexes for better query performance
truckSchema.index({ driverId: 1 });
truckSchema.index({ currentStatus: 1 });
truckSchema.index({ isAvailable: 1 });
truckSchema.index({ locationLat: 1, locationLng: 1 });
truckSchema.index({ assignedWarehouse: 1 });

module.exports = mongoose.model('Truck', truckSchema);
