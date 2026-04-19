const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem.model');

/**
 * Zero-Overbooking Gate
 * 
 * Runs BEFORE a booking is finalized. Uses a MongoDB transaction to:
 *  1. Lock – findOneAndUpdate with $inc is atomic at document level
 *  2. Verify – available = currentQty - reservedQty - allocatedQty >= requiredStock
 *  3. Update – atomically increment allocatedQty
 *  4. attach inventoryItem to req so the route can reference it
 *
 * If the check passes, the booking route finalises normally.
 * If it fails, it returns 400 without touching the booking collection.
 */
const checkStockAvailability = async (req, res, next) => {
  const { inventoryId, requiredStock, weightKg } = req.body;

  // No inventory linkage requested → skip (backwards compatible)
  if (!inventoryId || !requiredStock) return next();

  const needed = parseFloat(requiredStock) || parseFloat(weightKg) || 0;
  if (needed <= 0) return next();

  // Start a MongoDB session for the transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Atomic: read + tentative allocation in one document-level write
    // We only proceed if available >= needed
    const item = await InventoryItem.findOneAndUpdate(
      {
        _id: inventoryId,
        // Guard condition: ensure enough stock exists
        $expr: {
          $gte: [
            { $subtract: ['$currentQty', { $add: ['$reservedQty', '$allocatedQty'] }] },
            needed
          ]
        }
      },
      { $inc: { allocatedQty: needed } },  // tentative hold
      { new: true, session }
    );

    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `⛔ Inventory depleted. Cannot allocate ${needed} ${req.body.unit || 'units'}. Another booking claimed the last stock.`
      });
    }

    // Attach to req — route handler will commit after booking is saved
    req._inventorySession = session;
    req._inventoryItem = item;
    req._inventoryAllocated = needed;

    next();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

/**
 * Call this AFTER the booking document has been saved successfully.
 * Commits the tentative allocation so it persists.
 */
const commitStockAllocation = async (req) => {
  if (req._inventorySession) {
    await req._inventorySession.commitTransaction();
    req._inventorySession.endSession();
  }
};

/**
 * Call this if the booking save FAILS.
 * Rolls back the tentative allocation automatically.
 */
const rollbackStockAllocation = async (req) => {
  if (req._inventorySession) {
    await req._inventorySession.abortTransaction();
    req._inventorySession.endSession();
  }
};

module.exports = { checkStockAvailability, commitStockAllocation, rollbackStockAllocation };
