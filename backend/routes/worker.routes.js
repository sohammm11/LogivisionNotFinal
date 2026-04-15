const express = require('express');
const Worker = require('../models/Worker.model');
const Shift = require('../models/Shift.model');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');
const { asyncHandler, AppError } = require('../middleware/error.middleware');

const router = express.Router();

// Get all workers for a warehouse
router.get('/', verifyToken, asyncHandler(async (req, res) => {
    const { warehouseId } = req.query;

    if (!warehouseId) {
        throw new AppError('Warehouse ID is required', 400);
    }

    const workers = await Worker.find({ warehouseId })
        .sort({ name: 1 });

    res.json({
        success: true,
        data: { workers }
    });
}));

// Get worker statistics
router.get('/stats', verifyToken, asyncHandler(async (req, res) => {
    const { warehouseId } = req.query;

    if (!warehouseId) {
        throw new AppError('Warehouse ID is required', 400);
    }

    const totalWorkers = await Worker.countDocuments({ warehouseId });
    const activeWorkers = await Worker.countDocuments({ warehouseId, isActive: true });

    // Calculate overtime (mocking logic based on model field for now)
    // In a real scenario, this would check shifts/attendance
    const overtimeWorkers = await Worker.countDocuments({
        warehouseId,
        hoursWorked: { $gt: 8 }
    });

    res.json({
        success: true,
        data: {
            total: totalWorkers,
            active: activeWorkers,
            overtime: overtimeWorkers
        }
    });
}));

// Update worker status
router.patch('/:id/status', verifyToken, authorizeRoles('WAREHOUSE_MANAGER', 'ADMIN'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive, role } = req.body;

    const worker = await Worker.findById(id);
    if (!worker) {
        throw new AppError('Worker not found', 404);
    }

    if (isActive !== undefined) worker.isActive = isActive;
    if (role) worker.role = role;

    await worker.save();

    res.json({
        success: true,
        message: 'Worker updated successfully',
        data: { worker }
    });
}));

// Worker Check-in
router.post('/:id/check-in', verifyToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { shiftId } = req.body;

    const worker = await Worker.findById(id);
    if (!worker) {
        throw new AppError('Worker not found', 404);
    }

    worker.checkIn(shiftId);
    await worker.save();

    // Broadcast to warehouse room
    req.io.to(worker.warehouseId).emit('worker:checkin', {
        worker: {
            _id: worker._id,
            name: worker.name,
            role: worker.role,
            checkinTime: worker.checkinTime,
            isActive: worker.isActive
        },
        timestamp: new Date()
    });

    res.json({
        success: true,
        message: 'Worker checked in successfully',
        data: { worker }
    });
}));

// Worker Check-out
router.post('/:id/check-out', verifyToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const worker = await Worker.findById(id);
    if (!worker) {
        throw new AppError('Worker not found', 404);
    }

    worker.checkOut();
    await worker.save();

    // Broadcast to warehouse room
    req.io.to(worker.warehouseId).emit('worker:checkout', {
        workerId: worker._id,
        checkoutTime: worker.checkoutTime,
        hoursWorked: worker.hoursWorked,
        timestamp: new Date()
    });

    res.json({
        success: true,
        message: 'Worker checked out successfully',
        data: { worker }
    });
}));

module.exports = router;
