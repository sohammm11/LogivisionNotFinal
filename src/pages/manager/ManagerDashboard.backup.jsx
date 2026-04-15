import React, { useState, useRef } from 'react';
import Navbar from '../../components/layout/Navbar';
import StatusPill from '../../components/ui/StatusPill';
import { useToast } from '../../context/ToastContext';
import { Search, Plus, MapPin, Truck, Package, QrCode, AlertTriangle, Users } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const initialInventory = [
  { sku: 'SKU-84721', name: 'Industrial Bearing Set', category: 'Machinery', qty: 245, reserved: 12, bin: 'A-12-03', status: 'IN STOCK' },
  { sku: 'SKU-39284', name: 'Hydraulic Pump V2', category: 'Components', qty: 8, reserved: 2, bin: 'B-04-11', status: 'LOW STOCK' },
  { sku: 'SKU-10293', name: 'Steel Fasteners Box', category: 'Hardware', qty: 892, reserved: 50, bin: 'C-08-01', status: 'IN STOCK' },
  { sku: 'SKU-55483', name: 'Control Panel Unit', category: 'Electronics', qty: 3, reserved: 1, bin: 'D-02-05', status: 'LOW STOCK' },
  { sku: 'SKU-67291', name: 'Rubber Gasket Pack', category: 'Materials', qty: 0, reserved: 0, bin: 'A-15-08', status: 'OUT OF STOCK' },
  { sku: 'SKU-99182', name: 'Motor Drive Belt', category: 'Machinery', qty: 156, reserved: 8, bin: 'B-11-03', status: 'IN STOCK' },
  { sku: 'SKU-44827', name: 'Sensor Module X5', category: 'Electronics', qty: 5, reserved: 2, bin: 'D-05-02', status: 'LOW STOCK' },
  { sku: 'SKU-73629', name: 'Lubricant Drum 50L', category: 'Consumables', qty: 42, reserved: 5, bin: 'E-01-04', status: 'IN STOCK' },
];

const inboundShipments = [
  { challanId: 'CH-2026-001', vendor: 'Bharat Heavy Electricals', cargo: 'Transformers x4', weight: '4,200 kg', eta: 'Today 14:30', status: 'IN TRANSIT' },
  { challanId: 'CH-2026-002', vendor: 'Apollo Tyres Ltd', cargo: 'Industrial Tyres x20', weight: '2,800 kg', eta: 'Today 16:00', status: 'EXPECTED' },
  { challanId: 'CH-2026-003', vendor: 'Siemens India', cargo: 'Control Panels x2', weight: '1,500 kg', eta: 'Tomorrow 10:00', status: 'SCHEDULED' },
  { challanId: 'CH-2026-004', vendor: 'JSW Steel', cargo: 'Steel Sheets x50', weight: '8,000 kg', eta: 'Mar 13 09:00', status: 'SCHEDULED' },
  { challanId: 'CH-2026-005', vendor: 'Amara Raja Batteries', cargo: 'Batteries x100', weight: '3,200 kg', eta: 'Mar 13 15:00', status: 'EXPECTED' },
];

const outboundOrders = [
  { orderId: 'ORD-9821', items: 'Machinery Parts x45', weight: '2,100 kg', truck: 'MH-12-AB-1234', driver: 'Ramesh Patil', status: 'LOADING' },
  { orderId: 'ORD-9822', items: 'Electronics x120', weight: '850 kg', truck: 'MH-14-CD-5678', driver: 'Suresh Kumar', status: 'READY' },
  { orderId: 'ORD-9823', items: 'Steel Components x80', weight: '3,400 kg', truck: 'MH-19-EF-9012', driver: 'Vijay Singh', status: 'DISPATCHED' },
  { orderId: 'ORD-9824', items: 'Rubber Products x200', weight: '1,200 kg', truck: 'MH-20-GH-3456', driver: 'Anil Sharma', status: 'IN TRANSIT' },
  { orderId: 'ORD-9825', items: 'Industrial Tools x35', weight: '1,800 kg', truck: 'MH-21-IJ-7890', driver: 'Prakash Jadhav', status: 'READY' },
];

const availableTrucks = [
  { id: 1, driver: 'Rajesh Driver', regNumber: 'MH-12-XY-9876', distance: '2.3 km', capacity: 85, pricePerKm: 45, type: '16ft Container' },
  { id: 2, driver: 'Amit Transport', regNumber: 'MH-14-ZW-5432', distance: '5.1 km', capacity: 60, pricePerKm: 38, type: '12ft Open' },
  { id: 3, driver: 'Vikram Logistics', regNumber: 'MH-19-AB-8765', distance: '8.7 km', capacity: 95, pricePerKm: 52, type: '20ft Container' },
  { id: 4, driver: 'Suresh Carrier', regNumber: 'MH-20-CD-4321', distance: '1.2 km', capacity: 40, pricePerKm: 30, type: '8ft Mini' },
];

const workforceData = [
  { name: 'Ramesh Patil', role: 'Loader', checkIn: '08:15', hours: 6.5, status: 'ACTIVE' },
  { name: 'Suresh Nair', role: 'Forklift Op', checkIn: '08:20', hours: 6.3, status: 'ACTIVE' },
  { name: 'Vijay Yadav', role: 'Checker', checkIn: '08:30', hours: 8.2, status: 'OVERTIME' },
  { name: 'Ankita More', role: 'Supervisor', checkIn: '07:45', hours: 7.0, status: 'ACTIVE' },
  { name: 'Deepak Sawant', role: 'Loader', checkIn: '09:00', hours: 5.5, status: 'ACTIVE' },
];

const ManagerDashboard = () => {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState('INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    cargoDescription: '',
    weightKg: '',
    pickupLocation: 'JNPT Hub Panvel'
  });
  const [radius, setRadius] = useState('10 km');
  const mapRef = useRef();

  // Custom truck marker icon
  const createTruckIcon = (capacity) => {
    return L.divIcon({
      className: 'custom-truck-marker',
      html: `<div class="w-[14px] h-[14px] bg-[#F59E0B] rounded-full border-2 border-white shadow-[0_0_10px_#F59E0B] flex items-center justify-center">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2">
          <path d="M5 17h14v-6H5v6zm3-4h8v2H8v-2z"/>
          <path d="M3 11h18l-1-7H4l-1 7z"/>
          <circle cx="7" cy="19" r="1"/>
          <circle cx="17" cy="19" r="1"/>
        </svg>
      </div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10]
    });
  };

  // Truck locations data
  const [truckLocations, setTruckLocations] = useState([
    { id: 1, driver: 'Rajesh Driver', regNumber: 'MH-12-XY-9876', lat: 18.9712, lng: 72.9234, capacity: 85, pricePerKm: 45, type: '16ft Container', distance: '2.3 km' },
    { id: 2, driver: 'Amit Transport', regNumber: 'MH-14-ZW-5432', lat: 18.9334, lng: 72.9876, capacity: 60, pricePerKm: 38, type: '12ft Open', distance: '5.1 km' },
    { id: 3, driver: 'Vikram Logistics', regNumber: 'MH-19-AB-8765', lat: 18.9876, lng: 73.0123, capacity: 95, pricePerKm: 52, type: '20ft Container', distance: '8.7 km' },
    { id: 4, driver: 'Suresh Carrier', regNumber: 'MH-20-CD-4321', lat: 18.9123, lng: 72.9567, capacity: 40, pricePerKm: 30, type: '8ft Mini', distance: '1.2 km' }
  ]);

  // Razorpay payment states
  const [paymentStep, setPaymentStep] = useState('booking'); // booking, payment, processing, success
  const [upiId, setUpiId] = useState('');
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [paymentTab, setPaymentTab] = useState('upi');
  const [transactionId, setTransactionId] = useState('');

  const handleBookingRequest = (truck) => {
    setSelectedTruck(truck);
    setPaymentStep('booking');
    setShowBookingModal(true);
  };

  const calculateCost = () => {
    const distance = selectedTruck?.distance || 0;
    const pricePerKm = selectedTruck?.pricePerKm || 0;
    const weight = parseFloat(bookingForm.weightKg) || 0;
    const baseCost = distance * pricePerKm;
    const weightMultiplier = weight / 1000; // Convert kg to tons for calculation
    const totalCost = baseCost * (1 + weightMultiplier * 0.1); // Add 10% per ton
    return Math.round(totalCost);
  };

  const handleProceedToPayment = () => {
    setPaymentStep('payment');
  };

  const handlePayment = (method) => {
    setPaymentStep('processing');
    setTimeout(() => setPaymentStep('verifying'), 1000);
    setTimeout(() => setPaymentStep('confirming'), 2000);
    setTimeout(() => {
      setTransactionId('TXN-2026-' + Math.random().toString(36).substr(2, 9).toUpperCase());
      setPaymentStep('success');
    }, 3000);
  };

  const handleTrackBooking = () => {
    setShowBookingModal(false);
    setPaymentStep('booking');
    // Update truck status to BOOKED
    const updatedTrucks = truckLocations.map(truck => {
      if (truck.id === selectedTruck.id) {
        return { ...truck, status: 'BOOKED' };
      }
      return truck;
    });
    setTruckLocations(updatedTrucks);
    
    // Emit socket event to driver
    if (window.socket) {
      window.socket.emit('booking-request', {
        driverId: selectedTruck.id,
        warehouseName: 'JNPT Hub Panvel',
        cargoDescription: bookingForm.cargoDescription,
        amount: calculateCost()
      });
    }
  };

  const handleDone = () => {
    setShowBookingModal(false);
    setPaymentStep('booking');
    setSelectedTruck(null);
    setBookingForm({ cargoDescription: '', weightKg: '', pickupLocation: 'JNPT Hub Panvel' });
    setUpiId('');
    setCardDetails({ number: '', expiry: '', cvv: '', name: '' });
    setPaymentTab('upi');
    setTransactionId('');
  };

  const handleSaveItem = () => {
    setShowAddItemModal(false);
    showToast('SKU added to inventory!', 'success');
  };

  const totalSKUs = initialInventory.length;
  const lowStockCount = initialInventory.filter(i => i.status === 'LOW STOCK').length;
  const inboundToday = inboundShipments.filter(s => s.eta.includes('Today')).length;
  const outboundActive = outboundOrders.filter(o => o.status !== 'DISPATCHED').length;

  return (
    <div className="min-h-screen bg-[#080C14] text-[#E8F0FE] flex flex-col">
      <Navbar />
      
      {/* DARK TAB BAR */}
      <div className="bg-[#0D1421] border-b border-[#1E2D45] sticky top-16 z-40">
        <div className="flex overflow-x-auto hide-scrollbar">
          {['INVENTORY', 'INBOUND', 'OUTBOUND', 'FREIGHT MARKETPLACE', 'WORKFORCE'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={"px-8 py-4 text-sm font-bold tracking-wide transition-all whitespace-nowrap relative " + (activeTab === tab ? 'text-[#F59E0B]' : 'text-[#6B7FA8] hover:text-[#E8F0FE]')}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#F59E0B]"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 p-6 max-w-[1600px] mx-auto w-full">

        {/* INVENTORY TAB */}
        {activeTab === 'INVENTORY' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative w-full sm:w-96">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7FA8]" />
                <input
                  type="text"
                  placeholder="Search SKU, Item Name, or Category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#1E2D45] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent bg-[#111827] text-[#E8F0FE] text-sm placeholder-[#6B7FA8]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => showToast('Scanning barcode via device camera...', 'info')}
                  className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#0DD9B0] text-[#0DD9B0] font-bold rounded-md hover:bg-[#0DD9B015] transition-colors text-sm"
                >
                  <QrCode size={16} />
                  SCAN BARCODE
                </button>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F59E0B] text-black font-bold rounded-md hover:bg-[#D97706] transition-colors text-sm"
                >
                  <Plus size={16} />
                  ADD ITEM
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total SKUs', val: totalSKUs, color: 'text-[#E8F0FE]' },
                { label: 'Low Stock Alerts', val: lowStockCount, color: 'text-[#F43F5E]', badge: true },
                { label: 'Inbound Today', val: inboundToday, color: 'text-[#0DD9B0]' },
                { label: 'Outbound Active', val: outboundActive, color: 'text-[#F59E0B]' }
              ].map((m, i) => (
                <div key={i} className="bg-[#111827] border border-[#1E2D45] rounded-md p-5">
                  <div className="text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2 flex items-center justify-between">
                    {m.label}
                    {m.badge && <span className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse"></span>}
                  </div>
                  <div className={"text-3xl font-mono-data font-bold " + m.color}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Inventory Table */}
            <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0D1421] border-b border-[#1E2D45]">
                  <tr className="text-[#6B7FA8] font-bold tracking-wider text-xs uppercase">
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4">ITEM NAME</th>
                    <th className="px-6 py-4">CATEGORY</th>
                    <th className="px-6 py-4">QTY</th>
                    <th className="px-6 py-4">RESERVED</th>
                    <th className="px-6 py-4">BIN</th>
                    <th className="px-6 py-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D45]">
                  {initialInventory
                    .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(item => (
                      <tr
                        key={item.sku}
                        className={"hover:bg-[#1A2235] transition-colors " + (item.status === 'LOW STOCK' ? 'border-l-4 border-l-[#F59E0B]' : '') + " " + (item.status === 'OUT OF STOCK' ? 'border-l-4 border-l-[#F43F5E]' : '')}
                      >
                        <td className="px-6 py-4 font-mono-data text-xs font-bold text-[#6B7FA8]">{item.sku}</td>
                        <td className="px-6 py-4 font-medium text-[#E8F0FE]">{item.name}</td>
                        <td className="px-6 py-4 text-[#6B7FA8]">{item.category}</td>
                        <td className="px-6 py-4 font-mono-data text-[#E8F0FE]">
                          {item.status === 'OUT OF STOCK' ? <span className="text-[#F43F5E] font-bold">0</span> : item.qty}
                        </td>
                        <td className="px-6 py-4 font-mono-data text-[#6B7FA8]">{item.reserved}</td>
                        <td className="px-6 py-4 font-mono-data font-bold text-[#0DD9B0]">{item.bin}</td>
                        <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INBOUND TAB */}
        {activeTab === 'INBOUND' && (
          <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-[#1E2D45] bg-[#0D1421]">
              <h3 className="font-bold flex items-center gap-2 text-[#E8F0FE]">
                <Package size={20} className="text-[#F59E0B]" />
                EXPECTED INBOUND SHIPMENTS
              </h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0D1421] border-b border-[#1E2D45]">
                <tr className="text-[#6B7FA8] font-bold tracking-wider text-xs uppercase">
                  <th className="px-6 py-4">CHALLAN ID</th>
                  <th className="px-6 py-4">VENDOR</th>
                  <th className="px-6 py-4">CARGO</th>
                  <th className="px-6 py-4">WEIGHT</th>
                  <th className="px-6 py-4">ETA</th>
                  <th className="px-6 py-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D45]">
                {inboundShipments.map(item => (
                  <tr key={item.challanId} className="hover:bg-[#1A2235] transition-colors">
                    <td className="px-6 py-4 font-mono-data text-[#F59E0B] font-bold">{item.challanId}</td>
                    <td className="px-6 py-4 font-medium text-[#E8F0FE]">{item.vendor}</td>
                    <td className="px-6 py-4 text-[#6B7FA8]">{item.cargo}</td>
                    <td className="px-6 py-4 font-mono-data text-[#E8F0FE]">{item.weight}</td>
                    <td className="px-6 py-4 font-mono-data text-[#0DD9B0] font-bold">{item.eta}</td>
                    <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* OUTBOUND TAB */}
        {activeTab === 'OUTBOUND' && (
          <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-[#1E2D45] bg-[#0D1421]">
              <h3 className="font-bold flex items-center gap-2 text-[#E8F0FE]">
                <Truck size={20} className="text-[#F59E0B]" />
                ACTIVE OUTBOUND ORDERS
              </h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0D1421] border-b border-[#1E2D45]">
                <tr className="text-[#6B7FA8] font-bold tracking-wider text-xs uppercase">
                  <th className="px-6 py-4">ORDER ID</th>
                  <th className="px-6 py-4">ITEMS</th>
                  <th className="px-6 py-4">WEIGHT</th>
                  <th className="px-6 py-4">TRUCK</th>
                  <th className="px-6 py-4">DRIVER</th>
                  <th className="px-6 py-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D45]">
                {outboundOrders.map(item => (
                  <tr key={item.orderId} className="hover:bg-[#1A2235] transition-colors">
                    <td className="px-6 py-4 font-mono-data text-[#F59E0B] font-bold">{item.orderId}</td>
                    <td className="px-6 py-4 text-[#E8F0FE]">{item.items}</td>
                    <td className="px-6 py-4 font-mono-data text-[#E8F0FE]">{item.weight}</td>
                    <td className="px-6 py-4 font-mono-data font-bold text-[#6B7FA8]">{item.truck}</td>
                    <td className="px-6 py-4 text-[#E8F0FE]">{item.driver}</td>
                    <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FREIGHT MARKETPLACE TAB */}
        {activeTab === 'FREIGHT MARKETPLACE' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[700px] animate-fade-in">
            {/* Left: Map */}
            <div className="bg-[#1A2235] rounded-md border border-[#1E2D45] overflow-hidden relative">
              <div className="absolute top-4 left-4 z-10 bg-[#080C14] border border-[#1E2D45] px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#0DD9B0] animate-pulse"></div>
                  <div className="text-xs text-[#6B7FA8] font-bold">Available ({truckLocations.length})</div>
                </div>
                <select 
                  value={radius} 
                  onChange={(e) => setRadius(e.target.value)}
                  className="bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-[#F59E0B]"
                >
                  <option>Within 5 km</option>
                  <option>Within 10 km</option>
                  <option>Within 25 km</option>
                  <option>Within 50 km</option>
                </select>
              </div>
              
              <div className="h-full min-h-[500px]">
                <MapContainer 
                  center={[18.9543, 72.9458]} 
                  zoom={11} 
                  className="h-full w-full"
                  ref={mapRef}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  
                  {truckLocations.map((truck) => (
                    <Marker
                      key={truck.id}
                      position={[truck.lat, truck.lng]}
                      icon={createTruckIcon(truck.capacity)}
                    >
                      <Popup className="custom-popup">
                        <div className="bg-[#111827] border border-[#F59E0B] rounded-lg p-3 min-w-[200px]">
                          <div className="font-bold text-sm mb-2 text-[#E8F0FE] font-mono">{truck.driver}</div>
                          <div className="text-xs text-[#6B7FA8] mb-1 font-mono">{truck.regNumber}</div>
                          <div className="text-xs text-[#6B7FA8] mb-2">{truck.type}</div>
                          
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#6B7FA8]">Available Capacity</span>
                              <span className="font-mono font-bold text-[#0DD9B0]">{truck.capacity}%</span>
                            </div>
                            <div className="w-full bg-[#1E2D45] rounded-full h-1.5">
                              <div className="bg-[#0DD9B0] h-1.5 rounded-full" style={{ width: truck.capacity + '%' }}></div>
                            </div>
                          </div>
                          
                          <div className="text-xs font-mono text-[#F59E0B] mb-3">₹{truck.pricePerKm}/km • {truck.distance}</div>
                          
                          <button
                            onClick={() => handleBookingRequest(truck)}
                            className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-bold py-1.5 px-3 rounded text-xs transition-colors"
                          >
                            REQUEST BOOKING
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Right: Available Trucks */}
            <div className="flex flex-col h-full bg-[#111827] border border-[#1E2D45] rounded-md p-5 overflow-hidden">
              <h3 className="font-bold mb-4 text-lg flex items-center gap-2 text-[#E8F0FE]">
                <Truck size={20} className="text-[#F59E0B]" />
                Available Drivers Nearby
              </h3>
              <div className="space-y-4 overflow-auto pr-1">
                {truckLocations.map((truck) => (
                  <div key={truck.id} className="bg-[#0D1421] border border-[#1E2D45] rounded-md p-4 hover:border-[#F59E0B] transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-base text-[#E8F0FE]">{truck.driver}</div>
                        <div className="text-xs font-mono-data text-[#6B7FA8]">{truck.regNumber} • {truck.type}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold flex items-center gap-1 text-[#F59E0B] text-sm">
                          <MapPin size={14} /> {truck.distance}
                        </div>
                        <div className="text-xs font-mono-data font-bold text-[#E8F0FE] mt-1">₹{truck.pricePerKm}/km</div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#6B7FA8]">Available Capacity</span>
                        <span className="font-mono-data font-bold text-[#0DD9B0]">{truck.capacity}%</span>
                      </div>
                      <div className="w-full bg-[#1E2D45] rounded-full h-2">
                        <div className="bg-[#0DD9B0] h-2 rounded-full" style={{ width: truck.capacity + '%' }}></div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBookingRequest(truck)}
                      className="w-full bg-transparent border-2 border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-black font-bold py-2 rounded transition-colors text-sm"
                    >
                      REQUEST BOOKING
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WORKFORCE TAB */}
        {activeTab === 'WORKFORCE' && (
          <div className="space-y-6 animate-fade-in">
            {/* Headcount Banner */}
            <div className="bg-[#0D1421] border border-[#1E2D45] rounded-md p-6 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-8 text-center md:text-left">
                <div>
                  <div className="text-xs font-bold tracking-wider text-[#6B7FA8] flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#0DD9B0] animate-pulse"></div>
                    ACTIVE NOW
                  </div>
                  <div className="text-5xl font-mono-data font-bold text-[#E8F0FE]">34</div>
                  <div className="text-xs text-[#6B7FA8] mt-1">workers on shift</div>
                </div>
                <div className="w-px h-16 bg-[#1E2D45] hidden md:block"></div>
                <div>
                  <div className="text-xs font-bold tracking-wider text-[#6B7FA8] mb-1">NEXT SHIFT IN</div>
                  <div className="text-3xl font-mono-data font-bold text-[#F59E0B]">2h 14m</div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-3 bg-[#F43F5E]/10 border border-[#F43F5E]/30 px-5 py-3 rounded-md">
                <AlertTriangle size={24} className="text-[#F43F5E] animate-pulse" />
                <div>
                  <div className="font-bold text-[#F43F5E] text-sm">3 workers OVERTIME</div>
                  <div className="text-xs text-[#6B7FA8]">Review attendance logs</div>
                </div>
              </div>
            </div>

            {/* Worker Table */}
            <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden">
              <div className="p-5 border-b border-[#1E2D45] bg-[#0D1421]">
                <h3 className="font-bold flex items-center gap-2 text-[#E8F0FE]">
                  <Users size={20} className="text-[#F59E0B]" />
                  WORKER DIRECTORY
                </h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0D1421] border-b border-[#1E2D45]">
                  <tr className="text-[#6B7FA8] font-bold tracking-wider text-xs uppercase">
                    <th className="px-6 py-4">NAME</th>
                    <th className="px-6 py-4">ROLE</th>
                    <th className="px-6 py-4">CHECK-IN</th>
                    <th className="px-6 py-4">HOURS</th>
                    <th className="px-6 py-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D45]">
                  {workforceData.map((worker, i) => (
                    <tr key={i} className={"hover:bg-[#1A2235] transition-colors " + (worker.status === 'OVERTIME' ? 'bg-[#F43F5E]/5' : '')}>
                      <td className="px-6 py-4 font-bold text-[#E8F0FE]">{worker.name}</td>
                      <td className="px-6 py-4 text-[#6B7FA8]">{worker.role}</td>
                      <td className="px-6 py-4 font-mono-data text-[#6B7FA8]">{worker.checkIn}</td>
                      <td className={"px-6 py-4 font-mono-data font-bold " + (worker.status === 'OVERTIME' ? 'text-[#F43F5E]' : 'text-[#E8F0FE]')}>{worker.hours}h</td>
                      <td className="px-6 py-4"><StatusPill status={worker.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* BOOKING MODAL WITH RAZORPAY FLOW */}
      {showBookingModal && selectedTruck && (
        <div className="fixed inset-0 bg-[#080C14] z-[100] flex justify-center items-center p-4">
          {paymentStep === 'booking' && (
            <div className="bg-[#111827] border-t-4 border-t-[#F59E0B] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in">
              <div className="bg-[#0D1421] p-4 text-[#E8F0FE] flex justify-between items-center">
                <h3 className="font-bold font-mono text-lg flex items-center gap-2">
                  <Truck size={20} className="text-[#F59E0B]" /> 
                  CONFIRM FREIGHT BOOKING
                </h3>
                <button onClick={() => setShowBookingModal(false)} className="text-[#6B7FA8] hover:text-white text-2xl">&times;</button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Selected Truck Details */}
                <div className="bg-[#0D1421] border border-[#1E2D45] rounded-md p-3">
                  <div className="font-bold text-sm text-[#E8F0FE] mb-1">{selectedTruck.driver}</div>
                  <div className="text-xs font-mono text-[#6B7FA8] mb-1">{selectedTruck.regNumber} • {selectedTruck.distance}km</div>
                  <div className="text-xs font-mono text-[#F59E0B] mt-1">₹{selectedTruck.pricePerKm}/km</div>
                </div>
                
                {/* Form Fields */}
                <div>
                  <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Cargo Description</label>
                  <textarea 
                    value={bookingForm.cargoDescription}
                    onChange={(e) => setBookingForm({...bookingForm, cargoDescription: e.target.value})}
                    className="w-full border border-[#1E2D45] rounded-md p-3 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none placeholder-[#6B7FA8]" 
                    rows="3" 
                    placeholder="Describe the cargo..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Weight in KG</label>
                    <input 
                      type="number" 
                      value={bookingForm.weightKg}
                      onChange={(e) => setBookingForm({...bookingForm, weightKg: e.target.value})}
                      className="w-full border border-[#1E2D45] rounded-md p-3 text-sm font-mono bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none" 
                      placeholder="e.g. 1500" 
                    />
                  </div>
                </div>
                
                {/* Auto-calculated cost */}
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-md p-3">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-[#6B7FA8]">Distance(km) × Price/km × (Weight/10) = Total Cost</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6B7FA8]">{selectedTruck.distance} × ₹{selectedTruck.pricePerKm} × {(parseFloat(bookingForm.weightKg) / 1000).toFixed(1)} =</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#F59E0B]">₹{calculateCost()}</div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowBookingModal(false)} 
                    className="flex-1 px-4 py-2.5 border-2 border-[#F43F5E] text-[#F43F5E] font-bold rounded-md hover:bg-[#F43F5E] hover:text-white transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={handleProceedToPayment}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-black font-bold rounded-md transition-all shadow-lg"
                  >
                    PROCEED TO PAYMENT
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {paymentStep === 'payment' && (
            <div className="bg-[#111827] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in">
              {/* Razorpay Header */}
              <div className="bg-[#528FF0] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                      <span className="text-[#528FF0] font-bold text-sm">R</span>
                    </div>
                    <span className="text-xl font-bold">Razorpay</span>
                  </div>
                  <button onClick={() => setShowBookingModal(false)} className="text-white/80 hover:text-white text-2xl">&times;</button>
                </div>
              </div>
              
              <div className="p-6">
                {/* Amount Display */}
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold">₹{calculateCost().toLocaleString('en-IN')}</span>
                </div>
                
                {/* Payment Tabs */}
                <div className="flex mb-6">
                  <button 
                    onClick={() => setPaymentTab('upi')}
                    className={"flex-1 py-3 font-bold transition-colors " + (paymentTab === 'upi' ? 'bg-white text-[#528FF0]' : 'bg-transparent text-white/60 border border-white/30')}
                  >
                    UPI
                  </button>
                  <button 
                    onClick={() => setPaymentTab('cards')}
                    className={"flex-1 py-3 font-bold transition-colors " + (paymentTab === 'cards' ? 'bg-white text-[#528FF0]' : 'bg-transparent text-white/60 border border-white/30')}
                  >
                    Cards
                  </button>
                </div>
                
                {/* UPI Section */}
                {paymentTab === 'upi' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white mb-2">Enter UPI ID</label>
                      <input 
                        type="text" 
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                        className="w-full border border-white/30 rounded-lg p-3 text-white bg-white/10 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                      />
                    </div>
                    <button 
                      onClick={() => handlePayment('upi')}
                      className="w-full bg-[#528FF0] hover:bg-[#4169E1] text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      VERIFY & PAY
                    </button>
                    
                    {/* UPI App Icons */}
                    <div className="flex justify-center gap-4 mt-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mb-1">
                          <span className="text-white text-xs font-bold">G</span>
                        </div>
                        <span className="text-white/80 text-xs">GPay</span>
                      </div>
                      <div className="text-center">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mb-1">
                          <span className="text-white text-xs font-bold">P</span>
                        </div>
                        <span className="text-white/80 text-xs">PhonePe</span>
                      </div>
                      <div className="text-center">
                        <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mb-1">
                          <span className="text-white text-xs font-bold">P</span>
                        </div>
                        <span className="text-white/80 text-xs">Paytm</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Cards Section */}
                {paymentTab === 'cards' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm text-white mb-2">Card Number</label>
                        <input 
                          type="text" 
                          value={cardDetails.number}
                          onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                          placeholder="XXXX XXXX XXXX XXXX"
                          maxLength={19}
                          className="w-full border border-white/30 rounded-lg p-3 text-white bg-white/10 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white mb-2">Expiry (MM/YY)</label>
                        <input 
                          type="text" 
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full border border-white/30 rounded-lg p-3 text-white bg-white/10 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white mb-2">CVV</label>
                        <input 
                          type="text" 
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                          placeholder="XXX"
                          maxLength={3}
                          className="w-full border border-white/30 rounded-lg p-3 text-white bg-white/10 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white mb-2">Name on Card</label>
                        <input 
                          type="text" 
                          value={cardDetails.name}
                          onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                          placeholder="John Doe"
                          className="w-full border border-white/30 rounded-lg p-3 text-white bg-white/10 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => handlePayment('cards')}
                      className="w-full bg-[#528FF0] hover:bg-[#4169E1] text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      PAY ₹{calculateCost().toLocaleString('en-IN')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {paymentStep === 'processing' && (
            <div className="bg-[#111827] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center justify-center p-8 animate-fade-in">
              <div className="w-16 h-16 border-4 border-t-transparent border-[#528FF0] rounded-full animate-spin"></div>
              <div className="mt-4 text-center">
                <div className="text-white text-lg font-bold">Processing payment...</div>
              </div>
            </div>
          )}
          
          {paymentStep === 'verifying' && (
            <div className="bg-[#111827] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center justify-center p-8 animate-fade-in">
              <div className="w-16 h-16 border-4 border-t-transparent border-[#528FF0] rounded-full animate-spin"></div>
              <div className="mt-4 text-center">
                <div className="text-white text-lg font-bold">Verifying with bank...</div>
              </div>
            </div>
          )}
          
          {paymentStep === 'confirming' && (
            <div className="bg-[#111827] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center justify-center p-8 animate-fade-in">
              <div className="w-16 h-16 border-4 border-t-transparent border-[#528FF0] rounded-full animate-spin"></div>
              <div className="mt-4 text-center">
                <div className="text-white text-lg font-bold">Confirming booking...</div>
              </div>
            </div>
          )}
          
          {paymentStep === 'success' && (
            <div className="bg-[#111827] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col items-center justify-center p-8 animate-fade-in">
              {/* Animated Success Checkmark */}
              <div className="relative mb-8">
                <div className="w-24 h-24 border-4 border-[#0DD9B0] rounded-full flex items-center justify-center">
                  <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none">
                    <path 
                      d="M9 12l2 2 2-2 7s2.293 0 4.293 0 6-2.293-2-2z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="text-[#0DD9B0] animate-draw-check"
                    />
                  </svg>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <div className="text-2xl font-mono font-bold text-[#0DD9B0] mb-2">PAYMENT SUCCESSFUL</div>
                <div className="text-sm text-[#6B7FA8] mb-4">Transaction ID: <span className="font-mono text-[#F59E0B]">{transactionId}</span></div>
                <div className="text-lg text-white mb-6">Amount paid: <span className="font-mono text-[#F59E0B]">₹{calculateCost().toLocaleString('en-IN')}</span></div>
                <div className="text-sm text-[#E8F0FE] mb-6">Booking ID: <span className="font-mono text-[#F59E0B]">{`BKG-2026-${Math.random().toString(36).substr(2, 9).toUpperCase()}`}</span></div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-2 h-2 bg-[#0DD9B0] rounded-full"></div>
                  <span className="text-sm text-white">Rajesh Kumar has been notified</span>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={handleTrackBooking}
                    className="flex-1 px-4 py-2.5 bg-[#0DD9B0] hover:bg-[#0BAA8D] text-black font-bold rounded-md transition-colors"
                  >
                    TRACK BOOKING
                  </button>
                  <button 
                    onClick={handleDone}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-black font-bold rounded-md transition-all"
                  >
                    DONE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex justify-center items-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111827] border border-[#1E2D45] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-[#0D1421] p-4 text-[#E8F0FE] flex justify-between items-center border-b-2 border-[#0DD9B0]">
              <h3 className="font-bold flex items-center gap-2"><Plus size={20} className="text-[#0DD9B0]" /> Add New SKU</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-[#6B7FA8] hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Item SKU</label>
                  <input type="text" className="w-full border border-[#1E2D45] rounded-md p-3 text-sm font-mono-data bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#0DD9B0] focus:outline-none" placeholder="e.g. SKU-9912" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Category</label>
                  <select className="w-full border border-[#1E2D45] rounded-md p-3 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#0DD9B0] focus:outline-none">
                    <option>Electronics</option><option>Steel</option><option>Pharma</option><option>FMCG</option><option>Machinery</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Item Name</label>
                <input type="text" className="w-full border border-[#1E2D45] rounded-md p-3 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#0DD9B0] focus:outline-none" placeholder="e.g. Industrial Pipe" />
              </div>
            </div>
            <div className="p-4 bg-[#0D1421] border-t border-[#1E2D45] flex gap-3">
              <button onClick={() => setShowAddItemModal(false)} className="flex-1 px-4 py-2.5 border border-[#1E2D45] text-[#6B7FA8] font-bold rounded-md hover:bg-[#1A2235]">CANCEL</button>
              <button onClick={handleSaveItem} className="flex-1 px-4 py-2.5 bg-[#0DD9B0] hover:bg-[#079A7D] text-black font-bold rounded-md shadow-lg shadow-[#0DD9B0]/20">SAVE ITEM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
