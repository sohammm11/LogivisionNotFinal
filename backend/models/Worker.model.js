const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['LOADER', 'FORKLIFT_OPERATOR', 'GUARD', 'SUPERVISOR', 'CLEANER', 'MECHANIC', 'QUALITY_CHECKER', 'PACKER'],
    index: true
  },
  warehouseId: {
    type: String,
    required: true,
    index: true
  },
  qrCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentShiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  checkinTime: {
    type: Date
  },
  checkoutTime: {
    type: Date
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['MALE', 'FEMALE', 'OTHER']
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  employmentType: {
    type: String,
    enum: ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'INTERN'],
    default: 'PERMANENT'
  },
  department: {
    type: String,
    enum: ['OPERATIONS', 'MAINTENANCE', 'SECURITY', 'HOUSEKEEPING', 'QUALITY', 'ADMIN'],
    default: 'OPERATIONS'
  },
  skills: [{
    type: String,
    enum: ['FORKLIFT', 'CRANE', 'WELDING', 'ELECTRICAL', 'COMPUTER', 'FIRST_AID', 'FIRE_SAFETY', 'HAZMAT_HANDLING']
  }],
  certifications: [{
    name: String,
    issuedBy: String,
    issueDate: Date,
    expiryDate: Date,
    certificateNumber: String,
    imageUrl: String
  }],
  uniformSize: {
    shirt: String,
    pant: String,
    shoes: String
  },
  salary: {
    basic: Number,
    hra: Number,
    da: Number,
    allowances: Number,
    total: Number
  },
  bankDetails: {
    accountNumber: String,
    bankName: String,
    branchName: String,
    ifscCode: String
  },
  attendance: [{
    date: {
      type: Date,
      required: true
    },
    checkinTime: Date,
    checkoutTime: Date,
    hoursWorked: Number,
    overtimeHours: Number,
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY'],
      default: 'PRESENT'
    },
    notes: String
  }],
  leaves: [{
    type: {
      type: String,
      enum: ['SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'COMPENSATORY'],
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: String,
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date
  }],
  performance: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    lastReviewDate: Date,
    nextReviewDate: Date,
    achievements: [String],
    warnings: [{
      date: Date,
      reason: String,
      severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH']
      }
    }]
  },
  health: {
    medicalFitness: {
      type: String,
      enum: ['FIT', 'UNFIT', 'PENDING'],
      default: 'PENDING'
    },
    lastMedicalCheckup: Date,
    nextMedicalCheckup: Date,
    medicalReports: [{
      type: String,
      url: String,
      date: Date
    }]
  },
  devices: [{
    type: {
      type: String,
      enum: ['PHONE', 'TABLET', 'SCANNER', 'RADIO'],
      required: true
    },
    deviceId: String,
    assignedDate: Date,
    returnedDate: Date,
    condition: {
      type: String,
      enum: ['GOOD', 'DAMAGED', 'LOST'],
      default: 'GOOD'
    }
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate unique QR code
workerSchema.pre('validate', async function (next) {
  if (!this.isNew || this.qrCode) return next();

  const prefix = 'WRK';
  const random = Math.floor(100000 + Math.random() * 900000);
  this.qrCode = `${prefix}-${random}`;

  next();
});

// Check in worker
workerSchema.methods.checkIn = function (shiftId) {
  this.checkinTime = new Date();
  this.currentShiftId = shiftId;
  this.isActive = true;
  this.lastActivity = new Date();
};

// Check out worker
workerSchema.methods.checkOut = function () {
  this.checkoutTime = new Date();

  if (this.checkinTime) {
    const durationMs = this.checkoutTime - this.checkinTime;
    this.hoursWorked = durationMs / (1000 * 60 * 60); // Convert to hours
  }

  this.currentShiftId = null;
  this.lastActivity = new Date();

  // Add to attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendanceRecord = {
    date: today,
    checkinTime: this.checkinTime,
    checkoutTime: this.checkoutTime,
    hoursWorked: this.hoursWorked,
    status: 'PRESENT'
  };

  // Remove existing record for today if any
  this.attendance = this.attendance.filter(record =>
    new Date(record.date).toDateString() !== today.toDateString()
  );

  this.attendance.push(attendanceRecord);
};

// Calculate total hours worked in a period
workerSchema.methods.getTotalHoursWorked = function (startDate, endDate) {
  return this.attendance
    .filter(record => record.date >= startDate && record.date <= endDate)
    .reduce((total, record) => total + (record.hoursWorked || 0), 0);
};

// Get current attendance status
workerSchema.methods.getCurrentAttendanceStatus = function () {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayAttendance = this.attendance.find(record =>
    new Date(record.date).toDateString() === today.toDateString()
  );

  if (this.checkinTime && !this.checkoutTime) {
    return 'CHECKED_IN';
  } else if (todayAttendance) {
    return todayAttendance.status;
  } else {
    return 'NOT_CHECKED_IN';
  }
};

// Check if worker has active certification
workerSchema.methods.hasValidCertification = function (certificationName) {
  const now = new Date();
  return this.certifications.some(cert =>
    cert.name === certificationName &&
    cert.expiryDate &&
    cert.expiryDate > now
  );
};

// Get expiring certifications (within 30 days)
workerSchema.methods.getExpiringCertifications = function () {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return this.certifications.filter(cert =>
    cert.expiryDate &&
    cert.expiryDate <= thirtyDaysFromNow
  );
};

// Calculate overtime for current day
workerSchema.methods.calculateOvertime = function () {
  if (!this.checkinTime || !this.checkoutTime) return 0;

  const regularHours = 8; // Regular working hours
  const workedHours = this.hoursWorked;

  return Math.max(0, workedHours - regularHours);
};

// Indexes for better query performance
workerSchema.index({ warehouseId: 1 });
// Redundant index removed

workerSchema.index({ isActive: 1 });
workerSchema.index({ currentShiftId: 1 });
workerSchema.index({ 'attendance.date': 1 });

module.exports = mongoose.model('Worker', workerSchema);
