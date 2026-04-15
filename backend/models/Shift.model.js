const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  warehouseId: {
    type: String,
    required: true,
    index: true
  },
  shiftName: {
    type: String,
    required: true,
    trim: true,
    enum: ['MORNING', 'AFTERNOON', 'NIGHT', 'GENERAL'],
    index: true
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format (24-hour)'
    }
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'End time must be in HH:MM format (24-hour)'
    }
  },
  expectedHeadcount: {
    type: Number,
    required: true,
    min: 1
  },
  currentHeadcount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker'
  },
  workers: [{
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker'
    },
    checkinTime: Date,
    checkoutTime: Date,
    hoursWorked: Number,
    status: {
      type: String,
      enum: ['SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'ABSENT'],
      default: 'SCHEDULED'
    },
    notes: String
  }],
  tasks: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker'
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    },
    dueTime: Date,
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker'
    }
  }],
  breaks: [{
    name: String,
    startTime: String,
    endTime: String,
    duration: Number // in minutes
  }],
  overtime: {
    approved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    reason: String
  },
  incidents: [{
    type: {
      type: String,
      enum: ['ACCIDENT', 'THEFT', 'DAMAGE', 'SAFETY_BREACH', 'OTHER'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker'
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    actionsTaken: String
  }],
  performance: {
    totalTasksCompleted: {
      type: Number,
      default: 0
    },
    totalTasksAssigned: {
      type: Number,
      default: 0
    },
    efficiency: {
      type: Number,
      default: 0
    },
    onTimeCompletion: {
      type: Number,
      default: 0
    }
  },
  notes: {
    type: String,
    trim: true
  },
  actualStartTime: Date,
  actualEndTime: Date,
  totalHoursWorked: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add worker to shift
shiftSchema.methods.addWorker = function (workerId) {
  const existingWorker = this.workers.find(w => w.workerId.toString() === workerId.toString());

  if (existingWorker) {
    existingWorker.status = 'SCHEDULED';
  } else {
    this.workers.push({
      workerId: workerId,
      status: 'SCHEDULED'
    });
  }

  this.currentHeadcount = this.workers.filter(w =>
    w.status === 'CHECKED_IN' || w.status === 'SCHEDULED'
  ).length;
};

// Remove worker from shift
shiftSchema.methods.removeWorker = function (workerId) {
  this.workers = this.workers.filter(w => w.workerId.toString() !== workerId.toString());
  this.currentHeadcount = this.workers.filter(w =>
    w.status === 'CHECKED_IN' || w.status === 'SCHEDULED'
  ).length;
};

// Check in worker
shiftSchema.methods.checkInWorker = function (workerId) {
  const worker = this.workers.find(w => w.workerId.toString() === workerId.toString());

  if (worker) {
    worker.checkinTime = new Date();
    worker.status = 'CHECKED_IN';
  } else {
    this.workers.push({
      workerId: workerId,
      checkinTime: new Date(),
      status: 'CHECKED_IN'
    });
  }

  if (!this.actualStartTime) {
    this.actualStartTime = new Date();
    this.status = 'ACTIVE';
  }
};

// Check out worker
shiftSchema.methods.checkOutWorker = function (workerId) {
  const worker = this.workers.find(w => w.workerId.toString() === workerId.toString());

  if (worker && worker.checkinTime) {
    worker.checkoutTime = new Date();
    worker.hoursWorked = (worker.checkoutTime - worker.checkinTime) / (1000 * 60 * 60);
    worker.status = 'CHECKED_OUT';
  }
};

// Get checked in workers
shiftSchema.methods.getCheckedInWorkers = function () {
  return this.workers.filter(w => w.status === 'CHECKED_IN');
};

// Get absent workers
shiftSchema.methods.getAbsentWorkers = function () {
  return this.workers.filter(w => w.status === 'SCHEDULED' && !w.checkinTime);
};

// Add task to shift
shiftSchema.methods.addTask = function (taskData) {
  this.tasks.push(taskData);
  this.performance.totalTasksAssigned++;
};

// Complete task
shiftSchema.methods.completeTask = function (taskId, completedBy) {
  const task = this.tasks.id(taskId);
  if (task) {
    task.status = 'COMPLETED';
    task.completedAt = new Date();
    task.completedBy = completedBy;
    this.performance.totalTasksCompleted++;
  }
};

// Calculate shift performance metrics
shiftSchema.methods.calculatePerformance = function () {
  const totalTasks = this.performance.totalTasksAssigned;
  const completedTasks = this.performance.totalTasksCompleted;

  if (totalTasks > 0) {
    this.performance.efficiency = (completedTasks / totalTasks) * 100;
  }

  // Calculate on-time completion
  const now = new Date();
  const onTimeTasks = this.tasks.filter(task =>
    task.status === 'COMPLETED' &&
    task.dueTime &&
    task.completedAt <= task.dueTime
  ).length;

  if (completedTasks > 0) {
    this.performance.onTimeCompletion = (onTimeTasks / completedTasks) * 100;
  }
};

// Complete shift
shiftSchema.methods.completeShift = function () {
  this.status = 'COMPLETED';
  this.actualEndTime = new Date();

  if (this.actualStartTime) {
    this.totalHoursWorked = (this.actualEndTime - this.actualStartTime) / (1000 * 60 * 60);
  }

  this.calculatePerformance();
};

// Get shift duration in hours
shiftSchema.methods.getShiftDuration = function () {
  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);

  let duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

  if (duration < 0) {
    duration += 24 * 60; // Add 24 hours if end time is next day
  }

  return duration / 60; // Convert to hours
};

// Check if shift is currently active
shiftSchema.methods.isCurrentlyActive = function () {
  if (this.status !== 'ACTIVE') return false;

  const now = new Date();
  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (endMinutes > startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight shift
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
};

// Indexes for better query performance
shiftSchema.index({ warehouseId: 1, date: 1 });
shiftSchema.index({ warehouseId: 1, shiftName: 1 });
shiftSchema.index({ status: 1 });
shiftSchema.index({ createdBy: 1 });
// Redundant index removed


module.exports = mongoose.model('Shift', shiftSchema);
