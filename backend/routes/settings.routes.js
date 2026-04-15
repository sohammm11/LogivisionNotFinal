const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings.model');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');

// GET settings (returns the singleton document, creates if doesn't exist)
router.get('/', verifyToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  res.json({ success: true, data: settings });
}));

// PATCH platform settings
router.patch('/', verifyToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();

  const { platformName, defaultGate, maxEntriesPerShift, autoApproveMinutes } = req.body;
  if (platformName) settings.platformName = platformName;
  if (defaultGate) settings.defaultGate = defaultGate;
  if (maxEntriesPerShift !== undefined) settings.maxEntriesPerShift = maxEntriesPerShift;
  if (autoApproveMinutes !== undefined) settings.autoApproveMinutes = autoApproveMinutes;

  await settings.save();
  res.json({ success: true, data: settings });
}));

// PATCH warehouse settings
router.patch('/warehouse', verifyToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();

  const { warehouseName, warehouseAddress, totalDocks } = req.body;
  if (warehouseName) settings.warehouseName = warehouseName;
  if (warehouseAddress) settings.warehouseAddress = warehouseAddress;
  if (totalDocks !== undefined) settings.totalDocks = totalDocks;

  await settings.save();
  res.json({ success: true, data: settings });
}));

// PATCH notification settings
router.patch('/notifications', verifyToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();

  const { emailMismatch, smsMismatch, autoFlagEmptyVibe, requireRejectionReason } = req.body;
  
  if (emailMismatch !== undefined) settings.notifications.emailMismatch = emailMismatch;
  if (smsMismatch !== undefined) settings.notifications.smsMismatch = smsMismatch;
  if (autoFlagEmptyVibe !== undefined) settings.notifications.autoFlagEmptyVibe = autoFlagEmptyVibe;
  if (requireRejectionReason !== undefined) settings.notifications.requireRejectionReason = requireRejectionReason;

  await settings.save();
  res.json({ success: true, data: settings });
}));

module.exports = router;
