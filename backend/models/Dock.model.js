const mongoose = require('mongoose');

const dockSchema = new mongoose.Schema({
  dockNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: ['AVAILABLE', 'OCCUPIED', 'SCHEDULED', 'MAINTENANCE'],
    default: 'AVAILABLE'
  },
  assignedTruck: {
    type: String,
    trim: true,
    uppercase: true
  },
  assignedChallanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challan'
  },
  warehouseId: {
    type: String,
    required: true,
    index: true
  },
  slotStart: {
    type: Date
  },
  slotEnd: {
    type: Date
  },
  currentOperation: {
    type: String,
    enum: ['LOADING', 'UNLOADING', 'INSPECTION', 'IDLE'],
    default: 'IDLE'
  },
  capacity: {
    type: Number,
    default: 1 // number of trucks that can use this dock simultaneously
  },
  dockType: {
    type: String,
    enum: ['STANDARD', 'REEFER', 'HAZMAT', 'OVERSIZED'],
    default: 'STANDARD'
  },
  equipment: [{
    type: String,
    enum: ['FORKLIFT', 'PALLET_JACK', 'CRANE', 'CONVEYOR', 'RAMP']
  }],
  lastUsed: {
    type: Date
  },
  utilizationTime: {
    type: Number,
    default: 0 // total utilization time in minutes
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
dockSchema.index({ warehouseId: 1, dockNumber: 1 }, { unique: true });
dockSchema.index({ warehouseId: 1, status: 1 });
dockSchema.index({ assignedTruck: 1 });

// Method to check if dock is available for time slot
dockSchema.methods.isAvailableForSlot = function(startTime, endTime) {
  if (this.status === 'MAINTENANCE') return false;
  
  if (this.status === 'AVAILABLE') return true;
  
  if (this.status === 'SCHEDULED' && this.slotStart && this.slotEnd) {
    return (endTime <= this.slotStart) || (startTime >= this.slotEnd);
  }
  
  return false;
};

// Method to assign truck to dock
dockSchema.methods.assignTruck = function(truckNumber, challanId, startTime, endTime) {
  this.assignedTruck = truckNumber;
  this.assignedChallanId = challanId;
  this.status = 'OCCUPIED';
  this.slotStart = startTime;
  this.slotEnd = endTime;
  this.lastUsed = new Date();
};

// Method to release dock
dockSchema.methods.releaseDock = function() {
  this.assignedTruck = null;
  this.assignedChallanId = null;
  this.status = 'AVAILABLE';
  this.slotStart = null;
  this.slotEnd = null;
  this.currentOperation = 'IDLE';
};

// Method to schedule dock
dockSchema.methods.scheduleDock = function(truckNumber, challanId, startTime, endTime) {
  this.assignedTruck = truckNumber;
  this.assignedChallanId = challanId;
  this.status = 'SCHEDULED';
  this.slotStart = startTime;
  this.slotEnd = endTime;
};

module.exports = mongoose.model('Dock', dockSchema);
