const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  platformName: {
    type: String,
    default: 'LogiVision AI'
  },
  defaultGate: {
    type: String,
    default: 'Gate 01'
  },
  maxEntriesPerShift: {
    type: Number,
    default: 50
  },
  autoApproveMinutes: {
    type: Number,
    default: 15
  },
  warehouseName: {
    type: String,
    default: 'Chakan Main Hub'
  },
  warehouseAddress: {
    type: String,
    default: 'Phase 2, Chakan MIDC, Pune, Maharashtra 410501'
  },
  totalDocks: {
    type: Number,
    default: 10
  },
  notifications: {
    emailMismatch: { type: Boolean, default: true },
    smsMismatch: { type: Boolean, default: false },
    autoFlagEmptyVibe: { type: Boolean, default: true },
    requireRejectionReason: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
