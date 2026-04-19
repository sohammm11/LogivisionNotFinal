const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['ELECTRONICS', 'FMCG', 'AUTO_PARTS', 'PHARMA', 'TEXTILES', 'STEEL', 'CHEMICALS', 'FOOD', 'BEVERAGES', 'OTHER'],
    index: true
  },
  currentQty: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reservedQty: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    required: true,
    min: 0,
    default: 10
  },
  warehouseId: {
    type: String,
    required: true
  },
  binLocation: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'],
    default: 'IN_STOCK'
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'tons', 'pcs', 'boxes', 'liters', 'meters', 'pairs', 'sets'],
    default: 'pcs'
  },
  unitPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  supplier: {
    name: String,
    contactPerson: String,
    phone: String,
    email: String,
    leadTimeDays: {
      type: Number,
      default: 7
    }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    weight: Number,
    unit: {
      type: String,
      enum: ['cm', 'inches', 'mm'],
      default: 'cm'
    }
  },
  storageRequirements: {
    temperature: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ['C', 'F'],
        default: 'C'
      }
    },
    humidity: {
      min: Number,
      max: Number
    },
    specialHandling: [{
      type: String,
      enum: ['FRAGILE', 'HAZMAT', 'PERISHABLE', 'FLAMMABLE', 'TOXIC', 'REACTIVE']
    }]
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  manufactureDate: {
    type: Date
  },
  lastStockUpdate: {
    type: Date,
    default: Date.now
  },
  lastStockIn: {
    date: Date,
    quantity: Number,
    reference: String
  },
  lastStockOut: {
    date: Date,
    quantity: Number,
    reference: String
  },
  reorderPoint: {
    type: Number,
    min: 0
  },
  maxStockLevel: {
    type: Number,
    min: 0
  },
  averageMonthlyUsage: {
    type: Number,
    default: 0
  },
  qualityGrade: {
    type: String,
    enum: ['A', 'B', 'C', 'REJECTED'],
    default: 'A'
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  // Zero-Overbooking controls
  marketplaceVisible: {
    type: Boolean,
    default: true  // Manager can hide from driver feed
  },
  allocatedQty: {
    type: Number,
    default: 0,
    min: 0  // Qty committed to active bookings (not yet reserved/shipped)
  },
  qrCode: {
    type: String,
    trim: true
  },
  images: [{
    type: String
  }],
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['MSDS', 'SPECIFICATION', 'CERTIFICATE', 'OTHER']
    }
  }]
}, {
  timestamps: true
});

// Calculate status based on quantity and threshold
inventoryItemSchema.methods.calculateStatus = function () {
  const availableQty = this.currentQty - this.reservedQty;

  if (availableQty <= 0) {
    this.status = 'OUT_OF_STOCK';
  } else if (availableQty <= this.lowStockThreshold) {
    this.status = 'LOW_STOCK';
  } else {
    this.status = 'IN_STOCK';
  }

  return this.status;
};

// Get available quantity (subtracts both reserved and tentatively allocated qty)
inventoryItemSchema.methods.getAvailableQuantity = function () {
  return Math.max(0, this.currentQty - this.reservedQty - (this.allocatedQty || 0));
};

// Reserve stock
inventoryItemSchema.methods.reserveStock = function (quantity) {
  const availableQty = this.getAvailableQuantity();

  if (quantity > availableQty) {
    throw new Error(`Insufficient stock. Available: ${availableQty}, Requested: ${quantity}`);
  }

  this.reservedQty += quantity;
  this.calculateStatus();
  this.lastStockUpdate = new Date();
};

// Release reserved stock
inventoryItemSchema.methods.releaseReservedStock = function (quantity) {
  if (quantity > this.reservedQty) {
    throw new Error(`Cannot release more than reserved. Reserved: ${this.reservedQty}, Requested: ${quantity}`);
  }

  this.reservedQty -= quantity;
  this.calculateStatus();
  this.lastStockUpdate = new Date();
};

// Add stock
inventoryItemSchema.methods.addStock = function (quantity, reference) {
  this.currentQty += quantity;
  this.lastStockIn = {
    date: new Date(),
    quantity: quantity,
    reference: reference
  };
  this.calculateStatus();
  this.lastStockUpdate = new Date();
};

// Remove stock
inventoryItemSchema.methods.removeStock = function (quantity, reference) {
  const availableQty = this.getAvailableQuantity();

  if (quantity > availableQty) {
    throw new Error(`Insufficient stock. Available: ${availableQty}, Requested: ${quantity}`);
  }

  this.currentQty -= quantity;
  this.reservedQty = Math.max(0, this.reservedQty - quantity);
  this.lastStockOut = {
    date: new Date(),
    quantity: quantity,
    reference: reference
  };
  this.calculateStatus();
  this.lastStockUpdate = new Date();
};

// Check if item is expiring soon (within 30 days)
inventoryItemSchema.methods.isExpiringSoon = function () {
  if (!this.expiryDate) return false;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return this.expiryDate <= thirtyDaysFromNow;
};

// Check if item is expired
inventoryItemSchema.methods.isExpired = function () {
  if (!this.expiryDate) return false;
  return this.expiryDate < new Date();
};

// Calculate total value
inventoryItemSchema.methods.getTotalValue = function () {
  return this.currentQty * this.unitPrice;
};

// Pre-save middleware to calculate status
inventoryItemSchema.pre('save', function (next) {
  this.calculateStatus();
  next();
});

// Indexes for better query performance
inventoryItemSchema.index({ warehouseId: 1, category: 1 });
inventoryItemSchema.index({ warehouseId: 1, status: 1 });
inventoryItemSchema.index({ warehouseId: 1, binLocation: 1 });
inventoryItemSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
