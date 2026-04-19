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
  },
  integrations: {
    ewayBill: { type: Boolean, default: false },
    tally: { type: Boolean, default: false },
    tallyWebhook: { type: String, default: '' },
    fastag: { type: Boolean, default: false },
    whatsappAlerts: { type: Boolean, default: false },
    whatsappNumber: { type: String, default: '' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
