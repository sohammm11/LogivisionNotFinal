require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('./models/User.model');
const Challan = require('./models/Challan.model');
const Dock = require('./models/Dock.model');
const Truck = require('./models/Truck.model');
const InventoryItem = require('./models/InventoryItem.model');
const FreightBooking = require('./models/FreightBooking.model');
const Worker = require('./models/Worker.model');
const Shift = require('./models/Shift.model');

// Sample data
const warehouses = [
  { id: 'WH-001', name: 'JNPT Hub Panvel', location: 'Panvel, Maharashtra' },
  { id: 'WH-002', name: 'Nagpur MIHAN', location: 'Nagpur, Maharashtra' }
];

const users = [
  {
    name: 'Rajesh Kumar',
    email: 'guard@logivision.in',
    password: 'demo123',
    role: 'GUARD',
    warehouseId: 'WH-001',
    phone: '+919876543210'
  },
  {
    name: 'Amit Singh',
    email: 'driver@logivision.in',
    password: 'demo123',
    role: 'DRIVER',
    warehouseId: 'WH-001',
    phone: '+919876543211'
  },
  {
    name: 'Priya Sharma',
    email: 'manager@logivision.in',
    password: 'demo123',
    role: 'WAREHOUSE_MANAGER',
    warehouseId: 'WH-001',
    phone: '+919876543212'
  },
  {
    name: 'Vikram Malhotra',
    email: 'authority@logivision.in',
    password: 'demo123',
    role: 'AUTHORITY',
    warehouseId: 'WH-001',
    phone: '+919876543213'
  },
  {
    name: 'Anjali Patel',
    email: 'admin@logivision.in',
    password: 'demo123',
    role: 'ADMIN',
    warehouseId: 'WH-001',
    phone: '+919876543214'
  }
];

const trucks = [
  {
    regNo: 'MH12XX4421',
    driverId: null, // Will be set after creating users
    totalCapacityKg: 5000,
    currentLoadKg: 0,
    locationLat: 18.9894,
    locationLng: 73.1175,
    truckType: 'BOX_TRUCK',
    make: 'Tata',
    model: '407',
    year: 2022,
    fuelType: 'DIESEL',
    averageKmPerLiter: 8
  },
  {
    regNo: 'MH40AK7782',
    driverId: null,
    totalCapacityKg: 8000,
    currentLoadKg: 0,
    locationLat: 19.0760,
    locationLng: 72.8777,
    truckType: 'CONTAINER',
    make: 'Ashok Leyland',
    model: '3718',
    year: 2021,
    fuelType: 'DIESEL',
    averageKmPerLiter: 6
  },
  {
    regNo: 'GJ05BZ1190',
    driverId: null,
    totalCapacityKg: 3000,
    currentLoadKg: 0,
    locationLat: 18.5204,
    locationLng: 73.8567,
    truckType: 'FLATBED',
    make: 'Mahindra',
    model: 'Bolero Pickup',
    year: 2023,
    fuelType: 'DIESEL',
    averageKmPerLiter: 10
  },
  {
    regNo: 'MH04CX8834',
    driverId: null,
    totalCapacityKg: 6000,
    currentLoadKg: 0,
    locationLat: 19.0760,
    locationLng: 72.8777,
    truckType: 'REEFER',
    make: 'Eicher',
    model: 'Pro 6019',
    year: 2022,
    fuelType: 'DIESEL',
    averageKmPerLiter: 7
  },
  {
    regNo: 'KA09RR3312',
    driverId: null,
    totalCapacityKg: 4500,
    currentLoadKg: 0,
    locationLat: 12.9716,
    locationLng: 77.5946,
    truckType: 'BOX_TRUCK',
    make: 'Tata',
    model: 'LPT 912',
    year: 2021,
    fuelType: 'DIESEL',
    averageKmPerLiter: 9
  }
];

const inventoryItems = [
  // Electronics
  {
    sku: 'ELEC-001',
    name: 'Samsung 32" Smart TV',
    category: 'ELECTRONICS',
    currentQty: 50,
    reservedQty: 5,
    lowStockThreshold: 15,
    warehouseId: 'WH-001',
    binLocation: 'A1-01-01',
    unit: 'pcs',
    unitPrice: 18999,
    supplier: {
      name: 'Samsung Electronics India',
      phone: '+918022556677',
      email: 'purchase@samsung-india.com'
    }
  },
  {
    sku: 'ELEC-002',
    name: 'LG Refrigerator 190L',
    category: 'ELECTRONICS',
    currentQty: 8,
    reservedQty: 2,
    lowStockThreshold: 10,
    warehouseId: 'WH-001',
    binLocation: 'A1-01-02',
    unit: 'pcs',
    unitPrice: 12499,
    supplier: {
      name: 'LG Electronics India',
      phone: '+918022558899',
      email: 'purchase@lg-india.com'
    }
  },
  {
    sku: 'ELEC-003',
    name: 'Whirlpool Washing Machine 7kg',
    category: 'ELECTRONICS',
    currentQty: 25,
    reservedQty: 3,
    lowStockThreshold: 20,
    warehouseId: 'WH-001',
    binLocation: 'A1-01-03',
    unit: 'pcs',
    unitPrice: 15999,
    supplier: {
      name: 'Whirlpool India',
      phone: '+918022554433',
      email: 'purchase@whirlpool-india.com'
    }
  },
  // FMCG
  {
    sku: 'FMCG-001',
    name: 'Parle-G Biscuits 1kg',
    category: 'FMCG',
    currentQty: 500,
    reservedQty: 50,
    lowStockThreshold: 100,
    warehouseId: 'WH-001',
    binLocation: 'B2-01-01',
    unit: 'boxes',
    unitPrice: 85,
    supplier: {
      name: 'Parle Products',
      phone: '+912224578912',
      email: 'purchase@parle.in'
    }
  },
  {
    sku: 'FMCG-002',
    name: 'Amul Taaza Milk 1L',
    category: 'FMCG',
    currentQty: 200,
    reservedQty: 30,
    lowStockThreshold: 50,
    warehouseId: 'WH-001',
    binLocation: 'B2-01-02',
    unit: 'liters',
    unitPrice: 65,
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    supplier: {
      name: 'Amul Dairy',
      phone: '+917922746123',
      email: 'purchase@amul.com'
    }
  },
  {
    sku: 'FMCG-003',
    name: 'Coca-Cola 2L Bottle',
    category: 'BEVERAGES',
    currentQty: 150,
    reservedQty: 20,
    lowStockThreshold: 75,
    warehouseId: 'WH-001',
    binLocation: 'B2-01-03',
    unit: 'pcs',
    unitPrice: 85,
    supplier: {
      name: 'Coca-Cola India',
      phone: '+912224578901',
      email: 'purchase@coca-cola-india.com'
    }
  },
  // Auto Parts
  {
    sku: 'AUTO-001',
    name: 'Maruti Suzuki Engine Oil 5W-30',
    category: 'AUTO_PARTS',
    currentQty: 80,
    reservedQty: 10,
    lowStockThreshold: 25,
    warehouseId: 'WH-001',
    binLocation: 'C3-01-01',
    unit: 'liters',
    unitPrice: 450,
    supplier: {
      name: 'Maruti Suzuki',
      phone: '+911244177777',
      email: 'purchase@maruti.co.in'
    }
  },
  {
    sku: 'AUTO-002',
    name: 'MRF Tyre 175/65 R14',
    category: 'AUTO_PARTS',
    currentQty: 12,
    reservedQty: 2,
    lowStockThreshold: 15,
    warehouseId: 'WH-001',
    binLocation: 'C3-01-02',
    unit: 'pcs',
    unitPrice: 3200,
    supplier: {
      name: 'MRF Tyres',
      phone: '+914424534567',
      email: 'purchase@mrf-tyres.com'
    }
  },
  // Pharma
  {
    sku: 'PHAR-001',
    name: 'Dolo 650mg Paracetamol',
    category: 'PHARMA',
    currentQty: 1000,
    reservedQty: 100,
    lowStockThreshold: 200,
    warehouseId: 'WH-001',
    binLocation: 'D4-01-01',
    unit: 'pcs',
    unitPrice: 25,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    supplier: {
      name: 'Micro Labs',
      phone: '+918023456789',
      email: 'purchase@microlabs.in'
    }
  },
  {
    sku: 'PHAR-002',
    name: 'Crocin Advance 500mg',
    category: 'PHARMA',
    currentQty: 750,
    reservedQty: 50,
    lowStockThreshold: 300,
    warehouseId: 'WH-001',
    binLocation: 'D4-01-02',
    unit: 'pcs',
    unitPrice: 35,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    supplier: {
      name: 'GSK Pharma',
      phone: '+912224578934',
      email: 'purchase@gsk-india.com'
    }
  },
  // Textiles
  {
    sku: 'TEXT-001',
    name: 'Raymond Cotton Shirt',
    category: 'TEXTILES',
    currentQty: 200,
    reservedQty: 25,
    lowStockThreshold: 50,
    warehouseId: 'WH-001',
    binLocation: 'E5-01-01',
    unit: 'pcs',
    unitPrice: 1200,
    supplier: {
      name: 'Raymond Ltd',
      phone: '+912224578945',
      email: 'purchase@raymond.in'
    }
  },
  {
    sku: 'TEXT-002',
    name: 'Allen Solly Cotton T-Shirt',
    category: 'TEXTILES',
    currentQty: 150,
    reservedQty: 15,
    lowStockThreshold: 75,
    warehouseId: 'WH-001',
    binLocation: 'E5-01-02',
    unit: 'pcs',
    unitPrice: 699,
    supplier: {
      name: 'Allen Solly',
      phone: '+918023456123',
      email: 'purchase@allensolly.in'
    }
  },
  // Steel
  {
    sku: 'STEL-001',
    name: 'TMT Steel Bar 12mm',
    category: 'STEEL',
    currentQty: 5000,
    reservedQty: 500,
    lowStockThreshold: 1000,
    warehouseId: 'WH-001',
    binLocation: 'F6-01-01',
    unit: 'kg',
    unitPrice: 55,
    supplier: {
      name: 'Tata Steel',
      phone: '+913366328888',
      email: 'purchase@tatasteel.com'
    }
  },
  {
    sku: 'STEL-002',
    name: 'MS Steel Plate 10mm',
    category: 'STEEL',
    currentQty: 2000,
    reservedQty: 200,
    lowStockThreshold: 800,
    warehouseId: 'WH-001',
    binLocation: 'F6-01-02',
    unit: 'kg',
    unitPrice: 65,
    supplier: {
      name: 'JSW Steel',
      phone: '+912224578956',
      email: 'purchase@jswsteel.in'
    }
  },
  // Chemicals
  {
    sku: 'CHEM-001',
    name: 'Bleaching Powder 25kg',
    category: 'CHEMICALS',
    currentQty: 100,
    reservedQty: 10,
    lowStockThreshold: 30,
    warehouseId: 'WH-001',
    binLocation: 'G7-01-01',
    unit: 'pcs',
    unitPrice: 450,
    supplier: {
      name: 'Tata Chemicals',
      phone: '+912612830001',
      email: 'purchase@tatachemicals.com'
    }
  },
  {
    sku: 'CHEM-002',
    name: 'Sulphuric Acid 35L',
    category: 'CHEMICALS',
    currentQty: 50,
    reservedQty: 5,
    lowStockThreshold: 20,
    warehouseId: 'WH-001',
    binLocation: 'G7-01-02',
    unit: 'liters',
    unitPrice: 120,
    supplier: {
      name: 'BASF India',
      phone: '+912224578967',
      email: 'purchase@basf-india.com'
    }
  }
];

const challans = [
  {
    imageUrl: 'https://example.com/challan1.jpg',
    vehicleNo: 'MH12XX4421',
    vendorName: 'Reliance Industries Ltd',
    itemsList: [
      { itemName: 'Samsung Smart TV', quantity: 10, unit: 'pcs' },
      { itemName: 'LG Refrigerator', quantity: 5, unit: 'pcs' }
    ],
    totalWeight: 850,
    declaredLoad: 'FULL',
    visualLoad: 'FULL',
    destination: 'WH-001',
    status: 'VERIFIED',
    warehouseId: 'WH-001',
    priority: 'HIGH'
  },
  {
    imageUrl: 'https://example.com/challan2.jpg',
    vehicleNo: 'MH40AK7782',
    vendorName: 'ITC Limited',
    itemsList: [
      { itemName: 'Parle-G Biscuits', quantity: 100, unit: 'boxes' },
      { itemName: 'Coca-Cola Bottle', quantity: 50, unit: 'pcs' }
    ],
    totalWeight: 1200,
    declaredLoad: 'FULL',
    visualLoad: 'HALF',
    destination: 'WH-001',
    status: 'MISMATCH',
    warehouseId: 'WH-001',
    priority: 'MEDIUM',
    mismatchNotes: 'Visual load appears to be half of declared load'
  },
  {
    imageUrl: 'https://example.com/challan3.jpg',
    vehicleNo: 'GJ05BZ1190',
    vendorName: 'Maruti Suzuki India Ltd',
    itemsList: [
      { itemName: 'Engine Oil 5W-30', quantity: 20, unit: 'liters' },
      { itemName: 'MRF Tyre', quantity: 8, unit: 'pcs' }
    ],
    totalWeight: 450,
    declaredLoad: 'HALF',
    visualLoad: 'HALF',
    destination: 'WH-001',
    status: 'PENDING',
    warehouseId: 'WH-001',
    priority: 'LOW'
  },
  {
    imageUrl: 'https://example.com/challan4.jpg',
    vehicleNo: 'MH04CX8834',
    vendorName: 'Sun Pharmaceutical Industries',
    itemsList: [
      { itemName: 'Dolo 650mg', quantity: 200, unit: 'pcs' },
      { itemName: 'Crocin Advance', quantity: 150, unit: 'pcs' }
    ],
    totalWeight: 87.5,
    declaredLoad: 'HALF',
    visualLoad: 'HALF',
    destination: 'WH-001',
    status: 'VERIFIED',
    warehouseId: 'WH-001',
    priority: 'HIGH'
  },
  {
    imageUrl: 'https://example.com/challan5.jpg',
    vehicleNo: 'KA09RR3312',
    vendorName: 'Raymond Ltd',
    itemsList: [
      { itemName: 'Raymond Cotton Shirt', quantity: 50, unit: 'pcs' },
      { itemName: 'Allen Solly T-Shirt', quantity: 30, unit: 'pcs' }
    ],
    totalWeight: 40,
    declaredLoad: 'HALF',
    visualLoad: 'FULL',
    destination: 'WH-001',
    status: 'MISMATCH',
    warehouseId: 'WH-001',
    priority: 'MEDIUM',
    mismatchNotes: 'Visual load appears more than declared load'
  }
];

const docks = [];
for (let i = 1; i <= 20; i++) {
  const statuses = ['AVAILABLE', 'OCCUPIED', 'SCHEDULED'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  docks.push({
    dockNumber: `D${String(i).padStart(2, '0')}`,
    status: status,
    warehouseId: 'WH-001',
    dockType: 'STANDARD',
    capacity: 1,
    equipment: ['FORKLIFT', 'PALLET_JACK']
  });
}

const workers = [
  {
    name: 'Ramesh Kumar',
    role: 'LOADER',
    warehouseId: 'WH-001',
    employeeId: 'EMP001',
    phone: '+919876543215',
    address: {
      street: 'Sector 15, CBD Belapur',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400614'
    },
    emergencyContact: {
      name: 'Sunita Kumar',
      relationship: 'Wife',
      phone: '+919876543216'
    },
    dateOfBirth: new Date('1985-05-15'),
    gender: 'MALE',
    bloodGroup: 'B+',
    joinDate: new Date('2022-01-15'),
    employmentType: 'PERMANENT',
    department: 'OPERATIONS',
    skills: ['FORKLIFT', 'FIRST_AID']
  },
  {
    name: 'Suresh Yadav',
    role: 'FORKLIFT_OPERATOR',
    warehouseId: 'WH-001',
    employeeId: 'EMP002',
    phone: '+919876543217',
    address: {
      street: 'Sector 17, Kharghar',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '410210'
    },
    emergencyContact: {
      name: 'Geeta Yadav',
      relationship: 'Sister',
      phone: '+919876543218'
    },
    dateOfBirth: new Date('1990-08-22'),
    gender: 'MALE',
    bloodGroup: 'O+',
    joinDate: new Date('2021-06-10'),
    employmentType: 'PERMANENT',
    department: 'OPERATIONS',
    skills: ['FORKLIFT', 'CRANE']
  },
  {
    name: 'Anita Desai',
    role: 'SUPERVISOR',
    warehouseId: 'WH-001',
    employeeId: 'EMP003',
    phone: '+919876543219',
    address: {
      street: 'Sector 19, Vashi',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400703'
    },
    emergencyContact: {
      name: 'Rajesh Desai',
      relationship: 'Husband',
      phone: '+919876543220'
    },
    dateOfBirth: new Date('1988-03-10'),
    gender: 'FEMALE',
    bloodGroup: 'A+',
    joinDate: new Date('2020-03-01'),
    employmentType: 'PERMANENT',
    department: 'OPERATIONS',
    skills: ['COMPUTER', 'FIRST_AID', 'FIRE_SAFETY']
  },
  {
    name: 'Mukesh Singh',
    role: 'GUARD',
    warehouseId: 'WH-001',
    employeeId: 'EMP004',
    phone: '+919876543221',
    address: {
      street: 'Sector 12, Nerul',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400706'
    },
    emergencyContact: {
      name: 'Kavita Singh',
      relationship: 'Wife',
      phone: '+919876543222'
    },
    dateOfBirth: new Date('1992-11-28'),
    gender: 'MALE',
    bloodGroup: 'AB+',
    joinDate: new Date('2023-02-15'),
    employmentType: 'CONTRACT',
    department: 'SECURITY',
    skills: ['FIRST_AID']
  },
  {
    name: 'Lakshmi Nair',
    role: 'QUALITY_CHECKER',
    warehouseId: 'WH-001',
    employeeId: 'EMP005',
    phone: '+919876543223',
    address: {
      street: 'Sector 7, Sanpada',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400705'
    },
    emergencyContact: {
      name: 'Narayanan Nair',
      relationship: 'Father',
      phone: '+919876543224'
    },
    dateOfBirth: new Date('1991-07-18'),
    gender: 'FEMALE',
    bloodGroup: 'O+',
    joinDate: new Date('2021-09-20'),
    employmentType: 'PERMANENT',
    department: 'QUALITY',
    skills: ['COMPUTER']
  },
  {
    name: 'Rahul Verma',
    role: 'MECHANIC',
    warehouseId: 'WH-001',
    employeeId: 'EMP006',
    phone: '+919876543225',
    address: {
      street: 'Sector 14, Airoli',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400708'
    },
    emergencyContact: {
      name: 'Pooja Verma',
      relationship: 'Wife',
      phone: '+919876543226'
    },
    dateOfBirth: new Date('1989-12-05'),
    gender: 'MALE',
    bloodGroup: 'B+',
    joinDate: new Date('2020-11-10'),
    employmentType: 'PERMANENT',
    department: 'MAINTENANCE',
    skills: ['ELECTRICAL', 'WELDING']
  },
  {
    name: 'Shweta Patil',
    role: 'PACKER',
    warehouseId: 'WH-001',
    employeeId: 'EMP007',
    phone: '+919876543227',
    address: {
      street: 'Sector 18, Koparkhairane',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400709'
    },
    emergencyContact: {
      name: 'Ravi Patil',
      relationship: 'Brother',
      phone: '+919876543228'
    },
    dateOfBirth: new Date('1993-04-25'),
    gender: 'FEMALE',
    bloodGroup: 'A+',
    joinDate: new Date('2022-07-01'),
    employmentType: 'PERMANENT',
    department: 'OPERATIONS',
    skills: ['FIRST_AID']
  },
  {
    name: 'Vijay Kumar',
    role: 'LOADER',
    warehouseId: 'WH-001',
    employeeId: 'EMP008',
    phone: '+919876543229',
    address: {
      street: 'Sector 16, Ghansoli',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400701'
    },
    emergencyContact: {
      name: 'Meena Kumar',
      relationship: 'Mother',
      phone: '+919876543230'
    },
    dateOfBirth: new Date('1994-09-12'),
    gender: 'MALE',
    bloodGroup: 'O+',
    joinDate: new Date('2023-01-10'),
    employmentType: 'TEMPORARY',
    department: 'OPERATIONS'
  },
  {
    name: 'Deepak Sharma',
    role: 'FORKLIFT_OPERATOR',
    warehouseId: 'WH-001',
    employeeId: 'EMP009',
    phone: '+919876543231',
    address: {
      street: 'Sector 11, Turbhe',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400705'
    },
    emergencyContact: {
      name: 'Anita Sharma',
      relationship: 'Wife',
      phone: '+919876543232'
    },
    dateOfBirth: new Date('1990-06-30'),
    gender: 'MALE',
    bloodGroup: 'B+',
    joinDate: new Date('2021-12-15'),
    employmentType: 'PERMANENT',
    department: 'OPERATIONS',
    skills: ['FORKLIFT', 'CRANE']
  },
  {
    name: 'Kavita Reddy',
    role: 'CLEANER',
    warehouseId: 'WH-001',
    employeeId: 'EMP010',
    phone: '+919876543233',
    address: {
      street: 'Sector 10, Vashi',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pincode: '400703'
    },
    emergencyContact: {
      name: 'Ramesh Reddy',
      relationship: 'Husband',
      phone: '+919876543234'
    },
    dateOfBirth: new Date('1992-02-14'),
    gender: 'FEMALE',
    bloodGroup: 'A+',
    joinDate: new Date('2022-04-20'),
    employmentType: 'CONTRACT',
    department: 'HOUSEKEEPING'
  }
];

const shifts = [
  {
    warehouseId: 'WH-001',
    shiftName: 'MORNING',
    startTime: '06:00',
    endTime: '14:00',
    expectedHeadcount: 5,
    createdBy: null, // Will be set after creating admin user
    date: new Date()
  },
  {
    warehouseId: 'WH-001',
    shiftName: 'AFTERNOON',
    startTime: '14:00',
    endTime: '22:00',
    expectedHeadcount: 5,
    createdBy: null,
    date: new Date()
  },
  {
    warehouseId: 'WH-001',
    shiftName: 'NIGHT',
    startTime: '22:00',
    endTime: '06:00',
    expectedHeadcount: 3,
    createdBy: null,
    date: new Date()
  }
];

// Database connection and seeding
const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/logivision');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Truck.deleteMany({}),
      InventoryItem.deleteMany({}),
      Challan.deleteMany({}),
      Dock.deleteMany({}),
      Worker.deleteMany({}),
      Shift.deleteMany({}),
      FreightBooking.deleteMany({})
    ]);
    console.log('🗑️ Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`👤 Created user: ${user.name} (${user.email})`);
    }

    // Assign driver to trucks
    const driverUser = createdUsers.find(u => u.role === 'DRIVER');
    trucks.forEach(truck => {
      truck.driverId = driverUser._id;
      truck.assignedWarehouse = 'WH-001';
    });

    // Create trucks
    const createdTrucks = [];
    for (const truckData of trucks) {
      const truck = new Truck(truckData);
      await truck.save();
      createdTrucks.push(truck);
      console.log(`🚚 Created truck: ${truck.regNo}`);
    }

    // Create inventory items
    for (const itemData of inventoryItems) {
      const item = new InventoryItem(itemData);
      await item.save();
      console.log(`📦 Created inventory item: ${item.name}`);
    }

    // Create challans
    const guardUser = createdUsers.find(u => u.role === 'GUARD');
    for (const challanData of challans) {
      challanData.scannedBy = guardUser._id;
      const challan = new Challan(challanData);
      await challan.save();
      console.log(`📋 Created challan: ${challan.challanId}`);
    }

    // Create docks
    for (const dockData of docks) {
      const dock = new Dock(dockData);
      await dock.save();
      console.log(`🏢 Created dock: ${dock.dockNumber}`);
    }

    // Create workers
    for (const workerData of workers) {
      const worker = new Worker(workerData);
      await worker.save();
      console.log(`👷 Created worker: ${worker.name}`);
    }

    // Create shifts
    const adminUser = createdUsers.find(u => u.role === 'ADMIN');
    for (const shiftData of shifts) {
      shiftData.createdBy = adminUser._id;
      const shift = new Shift(shiftData);
      await shift.save();
      console.log(`⏰ Created shift: ${shift.shiftName}`);
    }

    // Create sample freight bookings
    const warehouseManagerUser = createdUsers.find(u => u.role === 'WAREHOUSE_MANAGER');
    const sampleBookings = [
      {
        truckId: createdTrucks[0]._id,
        driverId: driverUser._id,
        warehouseId: 'WH-001',
        cargoDescription: 'Electronics goods from Samsung to JNPT warehouse',
        weightKg: 850,
        distanceKm: 45,
        pricePerKm: 25,
        totalCost: 45 * 25,
        pickupAddress: {
          street: 'Samsung Factory',
          city: 'Noida',
          state: 'Uttar Pradesh',
          pincode: '201301',
          coordinates: { lat: 28.5355, lng: 77.3910 }
        },
        deliveryAddress: {
          street: 'JNPT Hub Panvel',
          city: 'Panvel',
          state: 'Maharashtra',
          pincode: '410206',
          coordinates: { lat: 18.9894, lng: 73.1175 }
        },
        status: 'COMPLETED',
        createdBy: warehouseManagerUser._id
      },
      {
        truckId: createdTrucks[1]._id,
        driverId: driverUser._id,
        warehouseId: 'WH-001',
        cargoDescription: 'FMCG products from ITC warehouse',
        weightKg: 1200,
        distanceKm: 62,
        pricePerKm: 20,
        totalCost: 62 * 20,
        pickupAddress: {
          street: 'ITC Warehouse',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400020',
          coordinates: { lat: 19.0760, lng: 72.8777 }
        },
        deliveryAddress: {
          street: 'JNPT Hub Panvel',
          city: 'Panvel',
          state: 'Maharashtra',
          pincode: '410206',
          coordinates: { lat: 18.9894, lng: 73.1175 }
        },
        status: 'IN_TRANSIT',
        createdBy: warehouseManagerUser._id
      }
    ];

    for (const bookingData of sampleBookings) {
      const booking = new FreightBooking(bookingData);
      await booking.save();
      console.log(`📦 Created freight booking: ${booking.bookingId}`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Trucks: ${createdTrucks.length}`);
    console.log(`   Inventory Items: ${inventoryItems.length}`);
    console.log(`   Challans: ${challans.length}`);
    console.log(`   Docks: ${docks.length}`);
    console.log(`   Workers: ${workers.length}`);
    console.log(`   Shifts: ${shifts.length}`);
    console.log(`   Freight Bookings: ${sampleBookings.length}`);

    console.log('\n🔑 Login Credentials:');
    console.log('   Email: guard@logivision.in (Password: demo123)');
    console.log('   Email: driver@logivision.in (Password: demo123)');
    console.log('   Email: manager@logivision.in (Password: demo123)');
    console.log('   Email: authority@logivision.in (Password: demo123)');
    console.log('   Email: admin@logivision.in (Password: demo123)');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`   FIELD: ${key} → ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the seed function
seedDatabase();
