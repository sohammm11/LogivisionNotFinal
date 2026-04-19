const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');

// Mock E-Way Bill Database
const mockEwbDB = {
  '331000000001': {
    challanId: 'CH-ST-001',
    vehicleNo: 'MH 14 GV 1122',
    vendorName: 'Tata Steel',
    destination: 'Chakan MIDC Gate 4',
    goodsDescription: 'HR Coils - 4T',
    totalWeight: '4000',
    totalValue: '450000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000001',
    fromLocation: 'Bhiwandi',
    toLocation: 'Chakan'
  },
  '331000000002': {
    challanId: 'CH-REL-442',
    vehicleNo: 'GJ 01 RJ 8877',
    vendorName: 'Reliance Industries',
    destination: 'Talegaon PH-1',
    goodsDescription: 'HDPE Granules - 8T',
    totalWeight: '8000',
    totalValue: '1200000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000002',
    fromLocation: 'Surat',
    toLocation: 'Talegaon'
  },
  '331000000003': {
    challanId: 'BE-9901',
    vehicleNo: 'MH 12 QB 4532',
    vendorName: 'Bajaj Electricals',
    destination: 'Ranjangaon Hub',
    goodsDescription: 'Lighting Fixtures',
    totalWeight: '2000',
    totalValue: '850000',
    declaredLoad: 'HALF',
    eway_bill_number: '331000000003',
    fromLocation: 'Pune',
    toLocation: 'Ranjangaon'
  },
  '331000000004': {
    challanId: 'HUL-WH-223',
    vehicleNo: 'MH 46 AR 2244',
    vendorName: 'HUL',
    destination: 'Chakan Phase 2',
    goodsDescription: 'FMCG Pallets - 12T',
    totalWeight: '12000',
    totalValue: '2800000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000004',
    fromLocation: 'Mumbai',
    toLocation: 'Chakan'
  },
  '331000000005': {
    challanId: 'ACC-3210',
    vehicleNo: 'MH 15 JK 9900',
    vendorName: 'ACC Cement',
    destination: 'Talegaon Logistics Park',
    goodsDescription: 'Cement Bags - 20T',
    totalWeight: '20000',
    totalValue: '150000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000005',
    fromLocation: 'Nashik',
    toLocation: 'Talegaon'
  },
  '331000000006': {
    challanId: 'AMZ-IND-001',
    vehicleNo: 'MH 12 TY 6677',
    vendorName: 'Amazon Fulfilment',
    destination: 'Chakan Central WH',
    goodsDescription: 'Mixed Electronics',
    totalWeight: '1500',
    totalValue: '3500000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000006',
    fromLocation: 'Bhiwandi',
    toLocation: 'Chakan'
  },
  '331000000007': {
    challanId: 'JCB-PUNE-88',
    vehicleNo: 'MH 14 EX 3344',
    vendorName: 'JCB India',
    destination: 'Talegaon Assembly',
    goodsDescription: 'Heavy Castings',
    totalWeight: '5000',
    totalValue: '890000',
    declaredLoad: 'HALF',
    eway_bill_number: '331000000007',
    fromLocation: 'Ballabgarh',
    toLocation: 'Talegaon'
  },
  '331000000008': {
    challanId: 'LG-EL-7721',
    vehicleNo: 'HR 38 VV 1010',
    vendorName: 'LG Electronics',
    destination: 'Ranjangaon LG Hub',
    goodsDescription: 'Refrigerator Components',
    totalWeight: '3000',
    totalValue: '2200000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000008',
    fromLocation: 'Greater Noida',
    toLocation: 'Ranjangaon'
  },
  '331000000009': {
    challanId: 'MAH-XY-55',
    vehicleNo: 'MH 15 MA 5566',
    vendorName: 'Mahindra Logistics',
    destination: 'Chakan M&M Gate 2',
    goodsDescription: 'Auto Parts (SKD)',
    totalWeight: '7500',
    totalValue: '1800000',
    declaredLoad: 'FULL',
    eway_bill_number: '331000000009',
    fromLocation: 'Nashik',
    toLocation: 'Chakan'
  },
  '331000000010': {
    challanId: 'NEST-772',
    vehicleNo: 'GA 01 KL 1212',
    vendorName: 'Nestle India',
    destination: 'Talegaon Cold Storage',
    goodsDescription: 'Maggi Noodles 100pkts',
    totalWeight: '1200',
    totalValue: '45000',
    declaredLoad: 'HALF',
    eway_bill_number: '331000000010',
    fromLocation: 'Ponda',
    toLocation: 'Talegaon'
  }
};

/**
 * @route POST /api/ewb/lookup
 * @desc Lookup E-Way Bill details from government database (MOCK)
 * @access Private
 */
router.post('/lookup', verifyToken, async (req, res) => {
  const { ewb_number } = req.body;

  if (!ewb_number) {
    return res.status(400).json({ success: false, message: 'E-Way Bill number is required' });
  }

  // Simulate real government portal API latency
  setTimeout(() => {
    const ewbData = mockEwbDB[ewb_number];

    if (!ewbData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid E-Way Bill number. No records found in government portal.' 
      });
    }

    res.status(200).json({
      success: true,
      data: ewbData,
      source: 'GOVT_PORTAL'
    });
  }, 800);
});

module.exports = router;
