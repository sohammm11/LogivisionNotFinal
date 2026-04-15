import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../../components/layout/Navbar';
import StatusPill from '../../components/ui/StatusPill';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../services/SocketProvider';
import { useAuth } from '../../context/AuthContext';
import { Search, Plus, MapPin, Truck, Package, AlertTriangle, Users, Check, X, RefreshCcw, ShieldCheck, Maximize } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';

const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
};

const createTruckIcon = (capacity) => {
  return L.divIcon({
    className: 'custom-truck-icon',
    html: `<div style="width:30px;height:30px;background:#111827;border-radius:50%;border:2px solid #F59E0B;box-shadow:0 0 15px rgba(245,158,11,0.4);display:flex;align-items:center;justify-content:center">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
      <div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:${capacity > 50 ? '#0DD9B0' : '#F43F5E'};border-radius:50%;border:2px solid #111827"></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const CITY_COORDINATES = {
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Navi Mumbai': { lat: 19.0330, lng: 73.0297 },
  'Thane': { lat: 19.2183, lng: 72.9781 },
  'Nashik': { lat: 19.9975, lng: 73.7898 },
  'Aurangabad': { lat: 19.8762, lng: 75.3433 }
};

const ManagerDashboard = () => {
  const showToast = useToast();
  const { user } = useAuth();
  const { socket, feed, mismatches } = useSocket();

  // Read token safely from both localStorage and sessionStorage
  const getToken = () => {
    const t1 = localStorage.getItem('logivision_token');
    if (t1 && t1 !== 'null' && t1 !== 'undefined') return t1;
    const t2 = sessionStorage.getItem('logivision_token');
    if (t2 && t2 !== 'null' && t2 !== 'undefined') return t2;
    return '';
  };

  // Handle 401 / expired token — clear storage and go to login
  const handleAuthError = () => {
    localStorage.removeItem('logivision_token');
    sessionStorage.removeItem('logivision_token');
    localStorage.removeItem('logivision_user');
    window.location.href = '/login';
  };
  const [activeTab, setActiveTab] = useState('INVENTORY');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(null); // stores the id of entry being updated
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    cargoDescription: '',
    weightKg: '',
    pickupAddress: {
      street: '',
      city: '',
      state: '',
      pincode: ''
    },
    deliveryAddress: {
      street: '',
      city: '',
      state: '',
      pincode: ''
    },
    notes: ''
  });
  const [radius, setRadius] = useState('10 km');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const mapRef = useRef();

  // Dynamic status states
  const [inboundShipments, setInboundShipments] = useState([]);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [outboundOrders, setOutboundOrders] = useState([]);
  const [truckLocations, setTruckLocations] = useState([]);
  const [availableTrucks, setAvailableTrucks] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workerStats, setWorkerStats] = useState({ total: 0, active: 0, overtime: 0 });
  const [docks, setDocks] = useState([]);
  const [dockStats, setDockStats] = useState({ totalDocks: 0, availableDocks: 0, occupiedDocks: 0 });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        if (!token) { handleAuthError(); return; }
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch Inbound (Challans)
        const challanRes = await fetch(`/api/challans?warehouseId=${user?.warehouseId}`, { headers });
        const challanData = await challanRes.json();
        if (challanData.success) {
          setInboundShipments(challanData.data.challans);
        }

        // Fetch Entries (Guard Feed) — deduplicate by business ID (challanId)
        const entriesRes = await fetch(`/api/entries?warehouseId=${user?.warehouseId}`, { headers });
        if (entriesRes.status === 401) { handleAuthError(); return; }
        const entriesData = await entriesRes.json();
        if (entriesData.success && Array.isArray(entriesData.data)) {
          const seen = new Set();
          const unique = entriesData.data.filter(e => {
            const key = String(e.challanId || e._id);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setPendingEntries(unique);
        }

        // Fetch Inventory
        const invRes = await fetch(`/api/inventory?warehouseId=${user?.warehouseId}`, { headers });
        const invData = await invRes.json();
        if (invData.success && invData.data.inventoryItems.length > 0) {
          setInventory(invData.data.inventoryItems);
        } else {
          setInventory([]);
        }

        // Fetch Outbound (Freight Bookings)
        const bookingRes = await fetch(`/api/freight/bookings?warehouseId=${user?.warehouseId}`, { headers });
        const bookingData = await bookingRes.json();
        if (bookingData.success) {
          setOutboundOrders(bookingData.data.bookings);
        }

        // Fetch Nearby Trucks (Dynamic - no hardcoded coords)
        const truckRes = await fetch(`/api/freight/available?warehouseId=${user?.warehouseId}`, { headers });
        const truckData = await truckRes.json();
        if (truckData.success) {
          setAvailableTrucks(truckData.data.trucks);
          setTruckLocations(truckData.data.trucks.map(t => ({
            id: t._id,
            driverId: t.driverId?._id,
            driver: t.driverId?.name || 'Unknown Driver',
            regNumber: t.regNo,
            lat: t.locationLat,
            lng: t.locationLng,
            capacity: t.availableCapacityPercent || 100,
            totalCapacityKg: t.totalCapacityKg || 20000,
            currentLoadKg: t.currentLoadKg || 0,
            availableKg: (t.totalCapacityKg - t.currentLoadKg) || 20000,
            pricePerKm: 45,
            type: t.truckType || t.model,
            distance: t.distance ? `${t.distance.toFixed(1)} km` : 'Distance Unknown'
          })));
        }
        // Fetch Workers
        const workerRes = await fetch(`/api/workers?warehouseId=${user?.warehouseId}`, { headers });
        const workerData = await workerRes.json();
        if (workerData.success) {
          setWorkers(workerData.data.workers);
        }

        // Fetch Worker Stats
        const workerStatsRes = await fetch(`/api/workers/stats?warehouseId=${user?.warehouseId}`, { headers });
        const workerStatsData = await workerStatsRes.json();
        if (workerStatsData.success) {
          setWorkerStats(workerStatsData.data);
        }

        // Fetch Docks
        const dockRes = await fetch(`/api/docks?warehouseId=${user?.warehouseId}`, { headers });
        const dockData = await dockRes.json();
        if (dockData.success) {
          setDocks(dockData.data.docks);
        }

        // Fetch Dock Stats
        const dockStatsRes = await fetch(`/api/docks/stats/warehouse?warehouseId=${user?.warehouseId}`, { headers });
        const dockStatsData = await dockStatsRes.json();
        if (dockStatsData.success) {
          setDockStats(dockStatsData.data);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };

    if (user?.warehouseId) fetchData();
  }, [user]);

  const fetchDockStats = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };
      const dockStatsRes = await fetch(`/api/docks/stats/warehouse?warehouseId=${user?.warehouseId}`, { headers });
      const dockStatsData = await dockStatsRes.json();
      if (dockStatsData.success) {
        setDockStats(dockStatsData.data);
      }
    } catch (err) {
      console.error('Error fetching dock stats:', err);
    }
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    console.log('Socket connected');

    socket.on('challan:scanned', (data) => {
      console.log('challan:scanned received', data);
      if (data?.challan) {
        setInboundShipments(prev => {
          const exists = prev.some(c => String(c.challanId || c._id) === String(data.challan.challanId || data.challan._id));
          return exists ? prev : [data.challan, ...prev];
        });
        setPendingEntries(prev => {
          const exists = prev.some(e => String(e.challanId || e._id) === String(data.challan.challanId || data.challan._id));
          return exists ? prev : [data.challan, ...prev];
        });
      }
    });

    socket.on('new_entry', (data) => {
      console.log('new_entry received', data);
      if (data) {
        setPendingEntries(prev => {
          const dataKey = String(data.challanId || data._id);
          // Deduplicate — skip if already in list by challanId or _id
          const exists = prev.some(e => {
            const entryKey = String(e.challanId || e._id);
            return entryKey === dataKey;
          });
          return exists ? prev : [data, ...prev];
        });
      }
    });

    socket.on('booking:accepted', (data) => {
      if (!data?.booking?._id) return;
      setOutboundOrders(prev => prev.map(o => o._id === data.booking._id ? data.booking : o));
    });

    socket.on('booking:location:updated', (data) => {
      if (!data?.bookingId) return;
      setOutboundOrders(prev => prev.map(o => {
        if (o._id === data.bookingId) {
          return {
            ...o,
            tracking: {
              ...o.tracking,
              currentLocation: data.location,
              lastUpdate: data.timestamp
            }
          };
        }
        return o;
      }));
      if (data.location) {
        setTruckLocations(prev => prev.map(t => {
          if (t.id === data.bookingId || t.driverId === data.driverId) {
            return { ...t, lat: data.location.lat, lng: data.location.lng };
          }
          return t;
        }));
      }
    });

    socket.on('worker:checkin', (data) => {
      if (!data?.worker) return;
      setWorkers(prev => [...prev, data.worker]);
      setWorkerStats(prev => ({ ...prev, active: prev.active + 1 }));
      showToast(`${data.worker.name} checked in`, 'info');
    });

    socket.on('worker:checkout', (data) => {
      if (!data?.workerId) return;
      setWorkers(prev => prev.filter(w => w._id !== data.workerId));
      setWorkerStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1) }));
    });

    // dock:updated fires both from dock-specific routes (data.dock present)
    // AND from the challan status route (only data.challan present, no data.dock).
    // Always refresh docks from the server to avoid stale state.
    socket.on('dock:updated', (data) => {
      if (data?.dock?._id) {
        setDocks(prev => prev.map(d => String(d._id) === String(data.dock._id) ? data.dock : d));
      }
      fetchDockStats();
      const token = getToken();
      if (!token) return;
      fetch(`/api/docks?warehouseId=${data?.warehouseId || user?.warehouseId || ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(d => {
        if (d.success && d.data?.docks) setDocks(d.data.docks);
      }).catch(() => {});
    });

    socket.on('challan:status:updated', (data) => {
      if (!data?.challan) return;
      const updatedChallan = data.challan;
      const idStr = String(updatedChallan.challanId || updatedChallan._id);
      
      const updateFn = prev => prev.filter(Boolean).map(c => {
        const match = String(c.challanId) === idStr || String(c._id) === idStr;
        return match ? { ...c, status: updatedChallan.status, verifiedAt: updatedChallan.verifiedAt } : c;
      });
      
      setInboundShipments(updateFn);
      setPendingEntries(updateFn);
      fetchDockStats();
    });

    socket.on('dock:released', (data) => {
      if (data?.dock?._id) {
        setDocks(prev => prev.map(d => String(d._id) === String(data.dock._id) ? data.dock : d));
      }
      fetchDockStats();
    });

    socket.on('booking:completed', (data) => {
      if (!data?.booking?._id) return;
      setOutboundOrders(prev => prev.map(o => o._id === data.booking._id ? data.booking : o));
    });

    socket.on('challan:location:updated', (data) => {
      if (!data?.challanId) return;
      setInboundShipments(prev => prev.map(c => {
        if (c.challanId === data.challanId) {
          return { ...c, currentLocation: data.location, eta: data.eta };
        }
        return c;
      }));
      // Also update map
      setTruckLocations(prev => prev.map(t => {
        if (t.id === data.challanId) {
          return { ...t, lat: data.location.lat, lng: data.location.lng };
        }
        return t;
      }));
    });

    socket.on('challan:accepted', (data) => {
      showToast(`Inbound Challan ${data.challanId} accepted by driver`, 'info');
    });

    socket.on('challan:verified', (data) => {
      showToast(`[Entry Cleared] Truck ${data.vehicleNo} verified`, 'success');
      const updateFn = prev => prev.filter(Boolean).map(c =>
        (c.vehicleNo === data.vehicleNo || c.challanId === data.challanId) ? { ...c, status: 'VERIFIED', verifiedAt: data.timestamp } : c
      );
      setInboundShipments(updateFn);
      setPendingEntries(updateFn);
    });

    socket.on('challan:mismatch', (data) => {
      showToast(`[Mismatch] Data conflict for Truck ${data.vehicleNo}`, 'warning');
      const updateFn = prev => prev.filter(Boolean).map(c =>
        (c.vehicleNo === data.vehicleNo || c.challanId === data.challanId) ? { ...c, status: 'MISMATCH', mismatchAt: data.timestamp } : c
      );
      setInboundShipments(updateFn);
      setPendingEntries(updateFn);
    });

    socket.on('driver:available', (payload) => {
      showToast(`Driver ${payload.driverName} available nearby`, 'info');
      setTruckLocations(prev => {
        // Only add if not already in list
        if (prev.find(t => t.driverId === payload.driverId)) return prev;
        
        return [...prev, {
          id: payload.driverId,
          driverId: payload.driverId,
          driver: payload.driverName,
          regNumber: 'LOGI-' + payload.driverId.slice(-4).toUpperCase(),
          lat: payload.location.lat,
          lng: payload.location.lng,
          capacity: 100 - ((payload.payload?.load || 0) / (payload.payload?.total || 20) * 100) || 100,
          totalCapacityKg: payload.payload?.total * 1000 || 20000,
          currentLoadKg: payload.payload?.load * 1000 || 0,
          availableKg: (payload.payload?.total - payload.payload?.load) * 1000 || 20000,
          pricePerKm: payload.rate || 38,
          type: payload.vehicle || 'Truck',
          distance: '0.1 km' // Mock distance
        }];
      });
    });

    socket.on('driver:offline', (payload) => {
      setTruckLocations(prev => prev.filter(t => t.driverId !== payload.driverId));
    });

    return () => {
      socket.off('challan:scanned');
      socket.off('booking:accepted');
      socket.off('booking:location:updated');
      socket.off('booking:completed');
      socket.off('worker:checkin');
      socket.off('worker:checkout');
      socket.off('dock:updated');
      socket.off('dock:released');
    };
  }, [socket, user]);

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
    const pCoords = CITY_COORDINATES[bookingForm.pickupAddress.city] || CITY_COORDINATES['Navi Mumbai'];
    const dCoords = CITY_COORDINATES[bookingForm.deliveryAddress.city] || CITY_COORDINATES['Pune'];

    // Haversine formula for dynamic distance
    const R = 6371;
    const dLat = (dCoords.lat - pCoords.lat) * Math.PI / 180;
    const dLon = (dCoords.lng - pCoords.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(pCoords.lat * Math.PI / 180) * Math.cos(dCoords.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dynamicDistance = R * c;

    const pricePerKm = parseFloat(selectedTruck?.pricePerKm) || 45;
    const weight = parseFloat(bookingForm.weightKg) || 0;

    if (dynamicDistance === 0 || weight === 0) return 0;

    const baseCost = dynamicDistance * pricePerKm;
    const weightMultiplier = weight / 1000;
    const totalCost = baseCost * (1 + weightMultiplier * 0.1);
    return { cost: Math.round(totalCost), distance: dynamicDistance.toFixed(1) };
  };

  const handleProceedToPayment = () => {
    setPaymentStep('payment');
  };

  const handlePayment = async (method) => {
    setPaymentStep('processing');

    // Step 2: Load Razorpay script dynamically
    const loadScript = () => new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

    const isLoaded = await loadScript();
    if (!isLoaded) {
      showToast("Razorpay SDK failed to load. Check connection.", "error");
      setPaymentStep('payment');
      return;
    }

    try {
      const token = localStorage.getItem('logivision_token');
      const deliveryCity = bookingForm.deliveryAddress.city || 'Pune';
      const coords = CITY_COORDINATES[deliveryCity] || CITY_COORDINATES['Pune'];
      const { cost, distance } = calculateCost();

      // Step 1: Call create-order with amount
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: cost })
      });
      const orderData = await orderRes.json();

      if (!orderData.success) throw new Error(orderData.message);

      // Step 3: Open Razorpay checkout modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LogiVision AI",
        description: `Freight Booking — ${selectedTruck?.driver} to ${deliveryCity}`,
        order_id: orderData.order_id,
        prefill: {
          name: user?.name,
          email: user?.email
        },
        theme: { color: "#F59E0B" },
        modal: {
          ondismiss: function() {
            setPaymentStep('booking');
          }
        },
        handler: async function (response) {
          setPaymentStep('confirming');

          // Step 4: Verify signature
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              managerId: user._id,
              driverId: selectedTruck?.driverId,
              amount: cost
            })
          });
          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Proceed to actually book the freight now that payment is verified
            const bookRes = await fetch('/api/freight/bookings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                truckId: selectedTruck.id,
                driverId: selectedTruck.driverId,
                warehouseId: user.warehouseId,
                cargoDescription: bookingForm.cargoDescription || 'Standard Freight Cargo',
                notes: bookingForm.notes,
                weightKg: parseFloat(bookingForm.weightKg) || 1000,
                distanceKm: parseFloat(distance),
                pricePerKm: selectedTruck.pricePerKm,
                pickupAddress: {
                  street: bookingForm.pickupAddress.street || 'JNPT Panvel Hub',
                  city: bookingForm.pickupAddress.city || 'Navi Mumbai',
                  state: bookingForm.pickupAddress.state || 'Maharashtra',
                  pincode: bookingForm.pickupAddress.pincode || '410206',
                  coordinates: CITY_COORDINATES[bookingForm.pickupAddress.city] || CITY_COORDINATES['Navi Mumbai']
                },
                deliveryAddress: {
                  street: bookingForm.deliveryAddress.street || 'Market Yard',
                  city: deliveryCity,
                  state: bookingForm.deliveryAddress.state || 'Maharashtra',
                  pincode: bookingForm.deliveryAddress.pincode || '411037',
                  coordinates: coords
                }
              })
            });
            const bookData = await bookRes.json();

            if (bookData.success) {
              setTransactionId(response.razorpay_payment_id);
              setPaymentStep('success'); // Shows green SUCCESS state
              showToast('Booking confirmed & driver notified!', 'success');
              setOutboundOrders(prev => [bookData.data.booking, ...prev]);

              if (socket) {
                socket.emit('custom-event', {
                  target: 'role',
                  targetRole: 'DRIVER',
                  type: 'booking:confirmed',
                  booking: bookData.data.booking
                });
              }
            } else {
              setPaymentStep('failed');
              showToast('Payment verified, but booking creation failed.', 'error');
            }
          } else {
            setPaymentStep('failed');
            showToast('Payment signature verification failed.', 'error');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      // Step 5: On payment failure
      rzp.on('payment.failed', function (response) {
        setPaymentStep('failed'); // Shows red FAILED state
        showToast(response.error.description || 'Payment Failed', 'error');
      });
      
      rzp.open();

    } catch (err) {
      setPaymentStep('payment');
      showToast(err.message || 'Booking initiation failed', 'error');
    }
  };

  const handleTrackBooking = () => {
    setShowBookingModal(false);
    setPaymentStep('booking');
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

  const handleUpdateStatus = async (id, status, notes = '', dock = '') => {
    if (!id) { alert('No entry ID found. Cannot update.'); return; }
    if (isUpdatingStatus) return;

    // No longer using blocking window.confirm/prompt for better UX and consistency
    setIsUpdatingStatus(id);

    try {
      const token = getToken();
      if (!token) { handleAuthError(); return; }

      let backendStatus = status;
      if (status === 'approved') backendStatus = 'VERIFIED';
      if (status === 'rejected') backendStatus = 'MISMATCH';

      // Only include optional fields when non-empty
      const body = { status: backendStatus };
      if (notes && notes.trim()) body.mismatchNotes = notes.trim();
      if (dock && dock.trim()) body.dockAssigned = dock.trim();

      const res = await fetch(`/api/challans/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401 || data.message?.includes('token')) {
          showToast('Session expired. Redirecting...', 'error');
          setTimeout(() => handleAuthError(), 2000);
          return;
        }
        const errMsg = data.message || data.errors?.[0]?.msg || `Server error ${res.status}`;
        showToast(`❌ Failed: ${errMsg}`, 'error');
        return;
      }

      // Success confirmation
      const actionLabel = backendStatus === 'VERIFIED' ? 'APPROVED ✅' : 'REJECTED ❌';
      showToast(`Challan ${actionLabel} successfully!`, backendStatus === 'VERIFIED' ? 'success' : 'error');

      // Update local state — change status so card is filtered out of PENDING
      const idStr = String(id);
      const updateFn = prev => prev.filter(Boolean).map(c => {
        const match = String(c.challanId) === idStr || String(c._id) === idStr;
        return match ? { ...c, status: backendStatus } : c;
      });
      setInboundShipments(updateFn);
      setPendingEntries(updateFn);
      setSelectedVerification(null);

      // Refresh data immediately
      fetchDockStats();
      const dockRes = await fetch(`/api/docks?warehouseId=${user?.warehouseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dockData = await dockRes.json();
      if (dockData.success && dockData.data?.docks) {
        setDocks(dockData.data.docks);
      }

      // Notify guard app
      if (socket) {
        socket.emit('custom-event', {
          target: 'role', targetRole: 'GUARD',
          type: 'entry_updated', challanId: id,
          status: backendStatus, timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Update Status Error:', err);
      showToast(`❌ Error: ${err.message || 'Update failed.'}`, 'error');
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleReassignDock = (entry) => {
    const newDock = prompt("Enter new Dock assignment (e.g. Dock D-07):", entry.dockAssigned || "");
    if (newDock) {
      handleUpdateStatus(entry.challanId || entry._id, 'approved', 'Dock reassigned by manager', newDock);
    }
  };

  const totalSKUs = inventory.length;
  const lowStockCount = inventory.filter(i => i.status === 'LOW_STOCK').length;
  const inboundToday = inboundShipments.length;
  const outboundActive = outboundOrders.filter(o => o.status === 'ACCEPTED' || o.status === 'IN_TRANSIT' || o.status === 'LOADING').length;

  return (
    <div className="min-h-screen min-w-[1024px] bg-[#080C14] text-[#E8F0FE] flex flex-col">
      <Navbar />

      {/* DARK TAB BAR */}
      <div className="bg-[#0D1421] border-b border-[#1E2D45] sticky top-16 z-[1040]">
        <div className="flex overflow-x-auto hide-scrollbar">
          {['INVENTORY', 'INBOUND', 'OUTBOUND', 'FREIGHT MARKETPLACE', 'DOCKS', 'WORKFORCE', 'GUARD FEED'].map((tab) => (
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
                  {inventory.filter(item =>
                    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((item, i) => (
                    <tr key={i} className="hover:bg-[#1A2235] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-mono-data text-[#0DD9B0] text-xs font-bold">{item.sku}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#E8F0FE] group-hover:text-[#F59E0B] transition-colors">{item.name}</div>
                        <div className="text-[10px] text-[#6B7FA8] uppercase tracking-tighter">{item.category}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data font-bold text-[#E8F0FE]">{item.currentQty || item.qty}</span>
                          <span className="text-[10px] text-[#6B7FA8]">{item.unit || 'pcs'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono-data text-[#6B7FA8]">{item.reservedQty || item.reserved}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-between items-center bg-[#080C14] px-2 py-1 rounded border border-[#1E2D45] w-20">
                          <span className="text-xs font-mono-data text-[#E8F0FE]">{item.binLocation || item.bin}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill status={item.status.replace('_', ' ')} />
                      </td>
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
                  <th className="px-6 py-4">LIVE LOCATION</th>
                  <th className="px-6 py-4">EST. ARRIVAL</th>
                  <th className="px-6 py-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D45]">
                {inboundShipments.map(item => (
                  <tr key={item.challanId} className="hover:bg-[#1A2235] transition-colors">
                    <td className="px-6 py-4 font-mono-data text-[#F59E0B] font-bold">{item.challanId}</td>
                    <td className="px-6 py-4 font-medium text-[#E8F0FE]">{item.vendorName}</td>
                    <td className="px-6 py-4 text-[#6B7FA8] max-w-[200px] truncate">{item.cargoDescription || 'General Cargo'}</td>
                    <td className="px-6 py-4 font-mono-data text-[#E8F0FE]">{item.totalWeight} kg</td>
                    <td className="px-6 py-4 font-mono-data">
                      {item.currentLocation ? (
                        <div className="flex items-center gap-1 text-[#0DD9B0]">
                          <MapPin size={12} />
                          {item.currentLocation.lat.toFixed(4)}, {item.currentLocation.lng.toFixed(4)}
                        </div>
                      ) : (
                        <span className="text-[#6B7FA8]">Waiting...</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono-data text-[#0DD9B0] font-bold">
                      {item.eta ? new Date(item.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                        new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      )}
                    </td>
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
                  <th className="px-6 py-4">TRUCK/DRIVER</th>
                  <th className="px-6 py-4">LOCATION</th>
                  <th className="px-6 py-4">EST. ARRIVAL</th>
                  <th className="px-6 py-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D45]">
                {outboundOrders.map(item => (
                  <tr key={item._id} className="hover:bg-[#1A2235] transition-colors">
                    <td className="px-6 py-4 font-mono-data text-[#F59E0B] font-bold">{item.bookingId}</td>
                    <td className="px-6 py-4 text-[#E8F0FE] max-w-[200px] truncate">{item.cargoDescription}</td>
                    <td className="px-6 py-4 font-mono-data text-[#E8F0FE]">{item.weightKg} kg</td>
                    <td className="px-6 py-4">
                      <div className="text-[#E8F0FE] font-bold">{item.truckId?.regNo || 'N/A'}</div>
                      <div className="text-[10px] text-[#6B7FA8]">{item.driverId?.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#0DD9B0] font-mono-data text-xs">
                        <MapPin size={12} />
                        {item.tracking?.currentLocation ? `${item.tracking.currentLocation.lat.toFixed(4)}, ${item.tracking.currentLocation.lng.toFixed(4)}` : 'Signal Lost'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono-data text-[#E8F0FE]">
                      {item.estimatedArrivalTime ? new Date(item.estimatedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                        (item.estimatedDuration ? `${item.estimatedDuration.toFixed(1)}h` : '--')}
                    </td>
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

                  <ChangeView
                    center={truckLocations.length > 0 ? [truckLocations[0].lat, truckLocations[0].lng] : [18.9543, 72.9458]}
                    zoom={truckLocations.length > 0 ? 12 : 11}
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

                          {truck.cargoPreferences && truck.cargoPreferences.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {truck.cargoPreferences.map(pref => (
                                <span key={pref} className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-bold uppercase">{pref}</span>
                              ))}
                            </div>
                          )}

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

                  {/* Trip Preview Layers */}
                  {showBookingModal && (
                    <>
                      {(() => {
                        const pCity = bookingForm.pickupAddress.city || 'Navi Mumbai';
                        const dCity = bookingForm.deliveryAddress.city || 'Pune';
                        const pPosObj = CITY_COORDINATES[pCity] || CITY_COORDINATES['Navi Mumbai'];
                        const dPosObj = CITY_COORDINATES[dCity] || CITY_COORDINATES['Pune'];
                        const pPos = [pPosObj.lat, pPosObj.lng];
                        const dPos = [dPosObj.lat, dPosObj.lng];

                        return (
                          <>
                            <Marker position={pPos} icon={L.divIcon({
                              className: 'pickup-marker',
                              html: `<div style="width:12px;height:12px;background:#0DD9B0;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #0DD9B0"></div>`,
                              iconSize: [12, 12]
                            })}>
                              <Popup>Pickup Origin: {pCity}</Popup>
                            </Marker>
                            <Marker position={dPos} icon={L.divIcon({
                              className: 'drop-marker',
                              html: `<div style="width:12px;height:12px;background:#F59E0B;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #F59E0B"></div>`,
                              iconSize: [12, 12]
                            })}>
                              <Popup>Delivery Destination: {dCity}</Popup>
                            </Marker>
                            <Polyline
                              positions={[pPos, dPos]}
                              color="#F59E0B"
                              dashArray="5, 10"
                              weight={3}
                              opacity={0.6}
                            />
                          </>
                        );
                      })()}
                    </>
                  )}
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
                        {truck.cargoPreferences && truck.cargoPreferences.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {truck.cargoPreferences.map(pref => (
                              <span key={pref} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0DD9B0]/10 text-[#0DD9B0] border border-[#0DD9B0]/20 font-bold uppercase">{pref}</span>
                            ))}
                          </div>
                        )}
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

        {/* DOCKS TAB */}
        {activeTab === 'DOCKS' && (
          <div className="space-y-6 animate-fade-in">
            {/* Dock Stats Banner */}
            <div className="bg-[#0D1421] border border-[#1E2D45] rounded-md p-6 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-8 text-center md:text-left">
                <div>
                  <div className="text-xs font-bold tracking-wider text-[#6B7FA8] mb-1">AVAILABLE DOCKS</div>
                  <div className="text-5xl font-mono-data font-bold text-[#0DD9B0]">{dockStats.availableDocks}</div>
                </div>
                <div className="w-px h-16 bg-[#1E2D45] hidden md:block"></div>
                <div>
                  <div className="text-xs font-bold tracking-wider text-[#6B7FA8] mb-1">OCCUPIED</div>
                  <div className="text-3xl font-mono-data font-bold text-[#F43F5E]">{dockStats.occupiedDocks}</div>
                </div>
                <div className="w-px h-16 bg-[#1E2D45] hidden md:block"></div>
                <div>
                  <div className="text-xs font-bold tracking-wider text-[#6B7FA8] mb-1">OCCUPANCY RATE</div>
                  <div className="text-2xl font-mono-data font-bold text-[#F59E0B]">{dockStats.occupancyRate}%</div>
                </div>
              </div>
            </div>

            {/* Docks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {docks.map((dock) => (
                <div key={dock._id} className={"bg-[#111827] border rounded-md p-5 transition-all " + (dock.status === 'AVAILABLE' ? 'border-[#0DD9B0]/30 hover:border-[#0DD9B0]' : (dock.status === 'OCCUPIED' ? 'border-[#F43F5E]/30' : 'border-[#6B7FA8]/30'))}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-2xl font-bold font-mono-data text-[#E8F0FE]">{dock.dockNumber}</div>
                    <StatusPill status={dock.status} />
                  </div>

                  {dock.status === 'OCCUPIED' ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] text-[#6B7FA8] uppercase font-bold">Truck</div>
                        <div className="text-sm font-bold text-[#E8F0FE]">{dock.assignedTruck}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#6B7FA8] uppercase font-bold">Challan</div>
                        <div className="text-xs font-mono-data text-[#F59E0B]">{dock.assignedChallanId?.challanId}</div>
                      </div>
                      <button
                        onClick={async () => {
                          const token = localStorage.getItem('logivision_token');
                          const res = await fetch(`/api/docks/${dock._id}/release`, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          if (res.ok) showToast(`Dock ${dock.dockNumber} released`, 'success');
                        }}
                        className="w-full mt-2 py-2 text-xs font-bold text-[#F43F5E] border border-[#F43F5E]/30 rounded hover:bg-[#F43F5E] hover:text-white transition-all"
                      >
                        RELEASE DOCK
                      </button>
                    </div>
                  ) : (
                    <div className="h-[100px] flex items-center justify-center border-2 border-dashed border-[#1E2D45] rounded">
                      <span className="text-xs text-[#6B7FA8] font-bold">READY FOR ASSIGNMENT</span>
                    </div>
                  )}
                </div>
              ))}
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
                  <div className="text-5xl font-mono-data font-bold text-[#E8F0FE]">{workerStats.active}</div>
                  <div className="text-xs text-[#6B7FA8] mt-1">workers on shift</div>
                </div>
                <div className="w-px h-16 bg-[#1E2D45] hidden md:block"></div>
                <div>
                  <div className="text-xs font-bold tracking-wider text-[#6B7FA8] mb-1">TOTAL ROSTER</div>
                  <div className="text-3xl font-mono-data font-bold text-[#F59E0B]">{workerStats.total}</div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-3 bg-[#F43F5E]/10 border border-[#F43F5E]/30 px-5 py-3 rounded-md">
                <AlertTriangle size={24} className="text-[#F43F5E] animate-pulse" />
                <div>
                  <div className="font-bold text-[#F43F5E] text-sm">{workerStats.overtime} workers OVERTIME</div>
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
                  {workers.map((worker) => (
                    <tr key={worker._id} className={"hover:bg-[#1A2235] transition-colors " + (worker.hoursWorked > 8 ? 'bg-[#F43F5E]/5' : '')}>
                      <td className="px-6 py-4 font-bold text-[#E8F0FE]">{worker.name}</td>
                      <td className="px-6 py-4 text-[#6B7FA8]">{worker.role}</td>
                      <td className="px-6 py-4 font-mono-data text-[#6B7FA8]">
                        {worker.checkinTime ? new Date(worker.checkinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </td>
                      <td className={"px-6 py-4 font-mono-data font-bold " + (worker.hoursWorked > 8 ? 'text-[#F43F5E]' : 'text-[#E8F0FE]')}>
                        {worker.hoursWorked?.toFixed(1) || '0.0'}h
                      </td>
                      <td className="px-6 py-4"><StatusPill status={worker.hoursWorked > 8 ? 'OVERTIME' : (worker.isActive ? 'ACTIVE' : 'OFFLINE')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GUARD FEED TAB */}
        {activeTab === 'GUARD FEED' && (
          <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3 text-[#E8F0FE]">
                  <ShieldCheck size={28} className="text-[#F59E0B]" />
                  Guard Security Feed
                </h2>
                <p className="text-sm text-[#6B7FA8] mt-1">Real-time manual entries and gate intelligence from security team.</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-[#111827] border border-[#F59E0B]/40 px-4 py-2 rounded-lg flex items-center gap-2">
                  <Package size={16} className="text-[#F59E0B]" />
                  <span className="text-sm font-bold text-[#E8F0FE]">{pendingEntries.filter(Boolean).filter(e => e.status === 'PENDING').length} Pending</span>
                </div>
                <div className="bg-[#111827] border border-[#0DD9B0]/40 px-4 py-2 rounded-lg flex items-center gap-2">
                  <Check size={16} className="text-[#0DD9B0]" />
                  <span className="text-sm font-bold text-[#E8F0FE]">{pendingEntries.filter(Boolean).filter(e => e.status === 'VERIFIED').length} Approved</span>
                </div>
              </div>
            </div>

            {/* SECTION 1 ─ PENDING APPROVALS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-l-[#F59E0B] pl-4 py-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Pending Approvals</h3>
                <span className="bg-[#1E2D45] text-[#F59E0B] text-[10px] font-bold px-2 py-0.5 rounded-full">ACTION REQUIRED</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingEntries.filter(Boolean).filter(e => e.status === 'PENDING').length > 0 ? (
                  pendingEntries.filter(Boolean).filter(e => e.status === 'PENDING').map((entry, idx) => (
                    <div 
                      key={entry._id || idx} 
                      onClick={() => setSelectedVerification(entry)}
                      className="bg-[#111827] border border-[#1E2D45] rounded-xl overflow-hidden hover:border-[#F59E0B]/50 transition-all shadow-xl cursor-pointer"
                    >
                      {/* Card Header */}
                      <div className="p-4 bg-[#0D1421] border-b border-[#1E2D45] flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                            <Truck size={16} />
                          </div>
                          <span className="font-mono font-bold text-white">{entry.vehicleNo || '—'}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#6B7FA8]">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </div>

                      {/* Load Evidence Preview */}
                      {entry.imageUrl && entry.imageUrl.startsWith('data:image') ? (
                        <div className="h-32 w-full bg-black relative">
                          <img 
                            src={entry.imageUrl} 
                            alt="Evidence" 
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" 
                          />
                          <div className="absolute bottom-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-white font-bold border border-white/10 uppercase tracking-tighter backdrop-blur-sm">
                            Vibe: {entry.visualLoad}
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 w-full bg-[#0D1421] flex flex-col items-center justify-center border-y border-[#1E2D45] opacity-30">
                          <Package size={24} className="mb-1" />
                          <span className="text-[8px] font-mono">NO VISUAL PROOF</span>
                        </div>
                      )}

                      {/* Card Body */}
                      <div className="p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-bold text-[#6B7FA8] uppercase mb-1">Challan ID</div>
                            <div className="text-sm font-bold text-white font-mono">{entry.challanId || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-[#6B7FA8] uppercase mb-1">Vibe Check</div>
                            <div className={`text-xs font-bold px-2 py-0.5 rounded ${(entry.visualLoad || '') === 'FULL' ? 'bg-[#0DD9B0]/10 text-[#0DD9B0]' : 'bg-[#F43F5E]/10 text-[#F43F5E]'}`}>
                              {entry.visualLoad || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#6B7FA8] uppercase mb-1">Details</div>
                          <div className="text-xs text-[#E8F0FE]">{entry.vendorName || '—'} → {entry.destination || '—'}</div>
                          <div className="text-xs text-[#6B7FA8] mt-1 italic">
                            {entry.cargoDescription || 'No description'} • {(entry.totalWeight ?? 0).toLocaleString()} KG
                          </div>
                        </div>
                        {entry.dockAssigned && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <MapPin size={10} className="text-[#F59E0B]" />
                            <span className="text-[#F59E0B] font-bold">Dock: {entry.dockAssigned}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-[#1E2D45] flex items-center justify-between text-[10px] text-[#6B7FA8]">
                          <span className="flex items-center gap-1"><Users size={10} /> Guard Entry</span>
                          <span className="text-[#6B7FA8]">{entry.status}</span>
                        </div>
                      </div>
                      {/* Action Buttons */}
                      <div className="p-3 bg-[#0D1421] border-t border-[#1E2D45] flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(entry.challanId || entry._id, 'rejected'); }}
                          disabled={!!isUpdatingStatus}
                          className={`flex-1 py-2 bg-transparent border border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                            entry.visualLoad === 'HALF' && entry.imageUrl && entry.imageUrl !== 'manual-entry' 
                              ? 'animate-[pulse_1s_ease-in-out_infinite] ring-2 ring-[#F43F5E]/50 shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                              : ''
                          }`}
                        >
                          {isUpdatingStatus === (entry.challanId || entry._id) ? <RefreshCcw size={14} className="animate-spin" /> : <X size={14} />} REJECT
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(entry.challanId || entry._id, 'approved'); }}
                          disabled={!!isUpdatingStatus}
                          className="flex-1 py-2 bg-[#F59E0B] text-black hover:bg-[#D97706] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpdatingStatus === (entry.challanId || entry._id) ? <RefreshCcw size={14} className="animate-spin" /> : <Check size={14} />} APPROVE
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-[#1E2D45] rounded-xl text-center">
                    <Check size={48} className="mb-4" />
                    <p className="font-mono text-sm">Clear queue. No pending entries to review.</p>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2 ─ MISMATCH FLAGS */}
            <div className="space-y-4 pt-4 border-t border-[#1E2D45]">
              <div className="flex items-center gap-2 border-l-4 border-l-[#F43F5E] pl-4 py-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Mismatch Flags</h3>
                <span className="bg-[#F43F5E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">ALERTS</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingEntries.filter(Boolean).filter(e => (e.visualLoad === 'HALF' || e.visualLoad === 'EMPTY') && e.status === 'PENDING').length > 0 ? (
                  pendingEntries.filter(Boolean).filter(e => (e.visualLoad === 'HALF' || e.visualLoad === 'EMPTY') && e.status === 'PENDING').map((entry, idx) => (
                    <div 
                      key={entry._id || idx} 
                      onClick={() => setSelectedVerification(entry)}
                      className="bg-[#111827] border-2 border-[#F43F5E]/30 rounded-xl overflow-hidden relative cursor-pointer hover:border-[#F43F5E] transition-all shadow-xl"
                    >
                      <div className="absolute top-0 right-0 px-2 py-1 bg-[#F43F5E] text-white text-[10px] font-bold rounded-bl-lg z-10">MISMATCH</div>
                      <div className="p-4 bg-[#0D1421] border-b border-[#1E2D45]">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-[#F43F5E]" />
                          <span className="font-mono font-bold text-white">{entry.vehicleNo || '—'}</span>
                        </div>
                      </div>

                      {/* Load Evidence Preview */}
                      {entry.imageUrl && entry.imageUrl.startsWith('data:image') ? (
                        <div className="h-32 w-full bg-black relative">
                          <img 
                            src={entry.imageUrl} 
                            alt="Evidence" 
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" 
                          />
                          <div className="absolute top-2 left-2 bg-red-600 px-1.5 py-0.5 rounded text-[8px] text-white font-bold animate-pulse shadow-lg">
                            MISMATCH DETECTED
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 w-full bg-[#0D1421] flex flex-col items-center justify-center border-y border-[#1E2D45] opacity-30">
                          <AlertTriangle size={24} className="mb-1 text-[#F43F5E]" />
                          <span className="text-[8px] font-mono">NO VISUAL EVIDENCE</span>
                        </div>
                      )}

                      <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 bg-[#0D1421] rounded border border-[#1E2D45]">
                            <div className="text-[10px] font-bold text-[#6B7FA8] uppercase mb-1">Declared</div>
                            <div className="text-xs font-bold text-white">{entry.declaredLoad || '—'}</div>
                          </div>
                          <div className="p-2 bg-[#F43F5E]/5 rounded border border-[#F43F5E]/30">
                            <div className="text-[10px] font-bold text-[#F43F5E] uppercase mb-1">Reported</div>
                            <div className="text-xs font-bold text-[#F43F5E]">{entry.visualLoad || '—'}</div>
                          </div>
                        </div>
                        <div className="text-xs text-[#6B7FA8]">
                          Challan: <span className="text-white font-mono">{entry.challanId || String(entry._id)}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-[#0D1421] border-t border-[#1E2D45]">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReassignDock(entry); }}
                          disabled={!!isUpdatingStatus}
                          className="w-full py-2 bg-transparent border border-[#0DD9B0] text-[#0DD9B0] hover:bg-[#0DD9B0] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCcw size={14} /> REASSIGN DOCK
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-[#1E2D45] rounded-xl text-center">
                    <AlertTriangle size={48} className="mb-4" />
                    <p className="font-mono text-sm">No load discrepancies reported.</p>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3 ─ ENTRY HISTORY */}
            <div className="space-y-4 pt-4 border-t border-[#1E2D45]">
              <div className="flex items-center gap-2 border-l-4 border-l-[#6B7FA8] pl-4 py-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Entry History</h3>
                <span className="bg-[#1E2D45] text-[#6B7FA8] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pendingEntries.filter(Boolean).filter(e => e.status === 'VERIFIED' || e.status === 'MISMATCH').length} RECORDS
                </span>
              </div>
              {pendingEntries.filter(Boolean).filter(e => e.status === 'VERIFIED' || e.status === 'MISMATCH').length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#1E2D45]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#0D1421] border-b border-[#1E2D45]">
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Vehicle</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Challan</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Vendor</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Dock</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Weight</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Status</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-[#6B7FA8] uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2D45]">
                      {pendingEntries.filter(Boolean).filter(e => e.status === 'VERIFIED' || e.status === 'MISMATCH').map((entry, idx) => (
                        <tr key={entry._id || idx} className="hover:bg-[#1A2235] transition-colors">
                          <td className="px-5 py-3 font-mono font-bold text-white">{entry.vehicleNo || '—'}</td>
                          <td className="px-5 py-3 font-mono text-[#6B7FA8] text-xs">{entry.challanId || '—'}</td>
                          <td className="px-5 py-3 text-[#E8F0FE] text-xs">{entry.vendorName || '—'}</td>
                          <td className="px-5 py-3 text-xs">
                            {entry.dockAssigned
                              ? <span className="text-[#F59E0B] font-bold">{entry.dockAssigned}</span>
                              : <span className="text-[#6B7FA8]">—</span>}
                          </td>
                          <td className="px-5 py-3 font-mono text-[#E8F0FE] text-xs">{(entry.totalWeight ?? 0).toLocaleString()} KG</td>
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${entry.status === 'VERIFIED' ? 'bg-[#0DD9B0]/10 text-[#0DD9B0]' : 'bg-[#F43F5E]/10 text-[#F43F5E]'}`}>
                              {entry.status === 'VERIFIED' ? '✓ APPROVED' : '✗ REJECTED'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[#6B7FA8] text-xs">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-[#1E2D45] rounded-xl text-center">
                  <Package size={40} className="mb-3" />
                  <p className="font-mono text-sm">No processed entries yet. History will appear here after approvals.</p>
                </div>
              )}
            </div>

          </div>
        )}



      </div>

      {/* BOOKING MODAL WITH RAZORPAY FLOW */}
      {showBookingModal && selectedTruck && (
        <div className="fixed inset-0 bg-[#080C14]/90 backdrop-blur-sm z-[9999] flex justify-center items-center p-4">
          {paymentStep === 'booking' && (
            <div className="bg-[#111827] border-t-4 border-t-[#F59E0B] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in">
              <div className="bg-[#0D1421] p-4 text-[#E8F0FE] flex justify-between items-center">
                <h3 className="font-bold font-mono text-lg flex items-center gap-2">
                  <Truck size={20} className="text-[#F59E0B]" />
                  CONFIRM FREIGHT BOOKING
                </h3>
                <button onClick={() => setShowBookingModal(false)} className="text-[#6B7FA8] hover:text-white text-2xl">&times;</button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
                {/* Selected Truck Details */}
                <div className="bg-[#0D1421] border border-[#1E2D45] rounded-md p-3">
                  <div className="font-bold text-sm text-[#E8F0FE] mb-1">{selectedTruck?.driver || 'Loading...'}</div>
                  <div className="text-xs font-mono text-[#6B7FA8] mb-1">{selectedTruck?.regNumber || '---'} • {selectedTruck?.distance || 'Distance Unknown'}</div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs font-mono text-[#F59E0B]">₹{selectedTruck?.pricePerKm || 0}/km</div>
                    <div className="text-[10px] font-bold text-[#0DD9B0] bg-[#0DD9B0]/10 px-2 py-0.5 rounded border border-[#0DD9B0]/30 font-mono">
                      AVAILABLE: {(selectedTruck?.availableKg || 0).toLocaleString()} KG / {(selectedTruck?.totalCapacityKg || 0).toLocaleString()} KG
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <form id="booking-form" onSubmit={(e) => { e.preventDefault(); handleProceedToPayment(); }} className="space-y-4">
                  {/* Datalists for suggestions */}
                  <datalist id="cargo-suggestions">
                    <option value="Electronics" />
                    <option value="FMCG" />
                    <option value="Auto Parts" />
                    <option value="Pharmaceuticals" />
                    <option value="Textiles" />
                    <option value="Perishables" />
                    <option value="Machinery" />
                  </datalist>
                  <datalist id="city-suggestions">
                    <option value="Mumbai" />
                    <option value="New Delhi" />
                    <option value="Bangalore" />
                    <option value="Hyderabad" />
                    <option value="Pune" />
                    <option value="Chennai" />
                  </datalist>

                  <div>
                    <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Cargo Description <span className="text-red-500">*</span></label>
                    <input
                      list="cargo-suggestions"
                      required
                      value={bookingForm.cargoDescription}
                      onChange={(e) => setBookingForm({ ...bookingForm, cargoDescription: e.target.value })}
                      className="w-full border border-[#1E2D45] rounded-md p-3 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none placeholder-[#6B7FA8]"
                      placeholder="e.g. Pharmaceutical supplies"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Weight in KG <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        required
                        min="1"
                        max={selectedTruck?.availableKg || 25000}
                        value={bookingForm.weightKg}
                        onChange={(e) => setBookingForm({ ...bookingForm, weightKg: e.target.value })}
                        className="w-full border border-[#1E2D45] rounded-md p-3 text-sm font-mono bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none"
                        placeholder="e.g. 1500"
                      />
                    </div>
                  </div>

                  {/* Driver Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Manager Message / Instructions</label>
                    <textarea
                      value={bookingForm.notes}
                      onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                      className="w-full border border-[#1E2D45] rounded-md p-3 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none placeholder-[#6B7FA8]"
                      rows="2"
                      placeholder="Add any specific message or instructions for the driver here..."
                    />
                  </div>

                  {/* Pickup Address Section */}
                  <div className="space-y-3 pt-2 border-t border-[#1E2D45]">
                    <label className="block text-xs font-bold text-[#0DD9B0] uppercase tracking-wider">Pickup Origin <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      minLength="5"
                      value={bookingForm.pickupAddress.street}
                      onChange={(e) => setBookingForm({ ...bookingForm, pickupAddress: { ...bookingForm.pickupAddress, street: e.target.value } })}
                      className="w-full border border-[#1E2D45] rounded-md p-2.5 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#0DD9B0] focus:outline-none"
                      placeholder="Street Address (Pickup)"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        list="city-suggestions"
                        type="text"
                        required
                        value={bookingForm.pickupAddress.city}
                        onChange={(e) => setBookingForm({ ...bookingForm, pickupAddress: { ...bookingForm.pickupAddress, city: e.target.value } })}
                        className="w-full border border-[#1E2D45] rounded-md p-2.5 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#0DD9B0] focus:outline-none"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        required
                        pattern="[0-9]{6}"
                        title="Exactly 6 digits"
                        value={bookingForm.pickupAddress.pincode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setBookingForm({ ...bookingForm, pickupAddress: { ...bookingForm.pickupAddress, pincode: val } })
                        }}
                        className="w-full border border-[#1E2D45] rounded-md p-2.5 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#0DD9B0] focus:outline-none font-mono"
                        placeholder="6-Digit Pincode"
                      />
                    </div>
                  </div>

                  {/* Delivery Address Section */}
                  <div className="space-y-3 pt-2 border-t border-[#1E2D45]">
                    <label className="block text-xs font-bold text-[#F59E0B] uppercase tracking-wider">Delivery Destination <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      minLength="5"
                      value={bookingForm.deliveryAddress.street}
                      onChange={(e) => setBookingForm({ ...bookingForm, deliveryAddress: { ...bookingForm.deliveryAddress, street: e.target.value } })}
                      className="w-full border border-[#1E2D45] rounded-md p-2.5 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none"
                      placeholder="Street Address"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        list="city-suggestions"
                        type="text"
                        required
                        value={bookingForm.deliveryAddress.city}
                        onChange={(e) => setBookingForm({ ...bookingForm, deliveryAddress: { ...bookingForm.deliveryAddress, city: e.target.value } })}
                        className="w-full border border-[#1E2D45] rounded-md p-2.5 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        required
                        pattern="[0-9]{6}"
                        title="Exactly 6 digits"
                        value={bookingForm.deliveryAddress.pincode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setBookingForm({ ...bookingForm, deliveryAddress: { ...bookingForm.deliveryAddress, pincode: val } })
                        }}
                        className="w-full border border-[#1E2D45] rounded-md p-2.5 text-sm bg-[#0D1421] text-[#E8F0FE] focus:ring-2 focus:ring-[#F59E0B] focus:outline-none font-mono"
                        placeholder="6-Digit Pincode"
                      />
                    </div>
                  </div>

                  {/* Auto-calculated cost */}
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-md p-3">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-[#6B7FA8]">Distance(km) × Price/km × (Weight/10) = Total Cost</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#6B7FA8]">
                        {calculateCost().distance} km × ₹{selectedTruck?.pricePerKm || 0}/km × {(parseFloat(bookingForm.weightKg) / 1000 || 0).toFixed(1)} tons =
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#F59E0B]">₹{(calculateCost().cost || 0).toLocaleString()}</div>
                  </div>

                  {/* Capacity Warning */}
                  {parseFloat(bookingForm.weightKg) > (selectedTruck?.availableKg || 0) && (
                    <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-[10px] font-bold animate-pulse">
                      <AlertTriangle size={14} />
                      LOAD EXCEEDS AVAILABLE CAPACITY ({(selectedTruck?.availableKg || 0).toLocaleString()} KG Max)
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowBookingModal(false)}
                      className="flex-1 px-4 py-2.5 border-2 border-[#F43F5E] text-[#F43F5E] font-bold rounded-md hover:bg-[#F43F5E] hover:text-white transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !bookingForm.cargoDescription || 
                        !bookingForm.weightKg || parseFloat(bookingForm.weightKg) <= 0 || parseFloat(bookingForm.weightKg) > (selectedTruck?.availableKg || 0) ||
                        !bookingForm.pickupAddress.street || bookingForm.pickupAddress.street.length < 5 ||
                        !bookingForm.pickupAddress.city ||
                        !bookingForm.pickupAddress.pincode || bookingForm.pickupAddress.pincode.length !== 6 ||
                        !bookingForm.deliveryAddress.street || bookingForm.deliveryAddress.street.length < 5 ||
                        !bookingForm.deliveryAddress.city ||
                        !bookingForm.deliveryAddress.pincode || bookingForm.deliveryAddress.pincode.length !== 6
                      }
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-black font-bold rounded-md transition-all shadow-lg disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                    >
                      PROCEED TO PAYMENT
                    </button>
                  </div>
                </form>
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
                  <span className="text-4xl font-bold">₹{calculateCost().cost.toLocaleString('en-IN')}</span>
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
                          onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
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
                          onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
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
                          onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
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
                          onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                          placeholder="John Doe"
                          className="w-full border border-white/30 rounded-lg p-3 text-white bg-white/10 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handlePayment('cards')}
                      className="w-full bg-[#528FF0] hover:bg-[#4169E1] text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      PAY ₹{calculateCost().cost.toLocaleString('en-IN')}
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
            <div className="bg-[#111827] rounded-lg shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] custom-scrollbar flex flex-col items-center justify-center p-8 animate-fade-in">
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
                <div className="text-lg text-white mb-6">Amount paid: <span className="font-mono text-[#F59E0B]">₹{calculateCost().cost.toLocaleString('en-IN')}</span></div>
                <div className="text-sm text-[#E8F0FE] mb-6">Booking ID: <span className="font-mono text-[#F59E0B]">{`BKG-2026-${Math.random().toString(36).substr(2, 9).toUpperCase()}`}</span></div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse"></div>
                  <span className="text-sm text-white">Booking Status: PENDING ACCEPTANCE</span>
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
            <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
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

      {/* Selected Verification Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 bg-black/80 z-[1200] flex justify-center items-center p-4 backdrop-blur-md animate-fade-in" onClick={() => setSelectedVerification(null)}>
          <div className="bg-[#111827] border border-[#1E2D45] rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 bg-[#0D1421] border-b border-[#1E2D45] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Truck className="text-[#F59E0B]" size={20} />
                <h3 className="font-bold text-lg text-white font-mono">{selectedVerification.vehicleNo}</h3>
                <span className="px-2 py-0.5 bg-[#1E2D45] text-[#6B7FA8] text-xs font-bold rounded">{selectedVerification.challanId || String(selectedVerification._id)}</span>
              </div>
              <button onClick={() => setSelectedVerification(null)} className="text-[#6B7FA8] hover:text-white p-1">
                <X size={24} />
              </button>
            </div>

            {/* Split Content: Image on top, details below or side by side */}
            <div className="flex flex-col md:flex-row overflow-y-auto max-h-[80vh] custom-scrollbar">
              
              {/* Evidence Section */}
              <div className="w-full md:w-1/2 min-h-[300px] bg-black relative border-b md:border-b-0 md:border-r border-[#1E2D45]">
                {selectedVerification.imageUrl && (selectedVerification.imageUrl.startsWith('data:image') || selectedVerification.imageUrl.startsWith('http')) ? (
                  <>
                    <img src={selectedVerification.imageUrl} alt="Load Proof" className="w-full h-full object-contain" />
                    <button 
                      onClick={() => window.open(selectedVerification.imageUrl, '_blank')}
                      className="absolute bottom-4 right-4 p-2 bg-black/60 rounded backdrop-blur hover:bg-[#F59E0B] text-white transition-colors"
                      title="Open full resolution in new tab"
                    >
                      <Maximize size={18} />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#6B7FA8] bg-[#0A0F1A]">
                    <Package size={48} className="mb-2 opacity-10" />
                    <p className="text-sm font-mono tracking-wider opacity-60">NO VISUAL EVIDENCE</p>
                    <p className="text-[10px] mt-1 opacity-40">Entry was submitted without a proof photo</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded backdrop-blur text-white text-xs font-bold border border-white/10 uppercase">
                  Vibe Check: <span className={selectedVerification.visualLoad === 'FULL' ? 'text-[#0DD9B0]' : 'text-[#F43F5E]'}>{selectedVerification.visualLoad || 'N/A'}</span>
                </div>
              </div>

              {/* Data Section */}
              <div className="w-full md:w-1/2 p-6 flex flex-col">
                <div className="space-y-6 flex-1">
                  <div>
                    <h4 className="text-[10px] font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Routing Details</h4>
                    <div className="bg-[#0D1421] p-3 rounded border border-[#1E2D45]">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#6B7FA8]">From: <span className="text-white font-bold">{selectedVerification.vendorName || '—'}</span></span>
                        <span className="text-xs text-[#6B7FA8]">To: <span className="text-[#F59E0B] font-bold">{selectedVerification.destination || '—'}</span></span>
                        <span className="text-xs text-[#6B7FA8]">Dock: <span className="text-[#0DD9B0] font-bold">{selectedVerification.dockAssigned || '—'}</span></span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">Cargo Metrics</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0D1421] p-3 rounded border border-[#1E2D45]">
                        <span className="block text-[10px] text-[#6B7FA8] uppercase mb-1">Items / Desc</span>
                        <span className="text-sm text-white">{selectedVerification.cargoDescription || 'No description'}</span>
                      </div>
                      <div className="bg-[#0D1421] p-3 rounded border border-[#1E2D45]">
                        <span className="block text-[10px] text-[#6B7FA8] uppercase mb-1">Measured Wt</span>
                        <span className="text-sm text-white font-mono">{(selectedVerification.totalWeight ?? 0).toLocaleString()} KG</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-[#6B7FA8] uppercase tracking-wider mb-2">System Metadata</h4>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#6B7FA8]">Time Logged:</span>
                        <span className="text-white font-mono">{selectedVerification.createdAt ? new Date(selectedVerification.createdAt).toLocaleString() : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7FA8]">Current Status:</span>
                        <span className="text-[#F59E0B] font-bold">{selectedVerification.status}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approve/Reject Controls matching Card */}
                {selectedVerification.status === 'PENDING' && (
                  <div className="mt-6 flex gap-3 pt-4 border-t border-[#1E2D45]">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUpdateStatus(selectedVerification.challanId || selectedVerification._id, 'rejected'); }}
                      disabled={!!isUpdatingStatus}
                      className="flex-1 py-3 bg-transparent border border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus === (selectedVerification.challanId || selectedVerification._id) ? <RefreshCcw size={16} className="animate-spin" /> : <X size={16} />} REJECT
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUpdateStatus(selectedVerification.challanId || selectedVerification._id, 'approved'); }}
                      disabled={!!isUpdatingStatus}
                      className="flex-1 py-3 bg-[#F59E0B] text-black hover:bg-[#D97706] rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus === (selectedVerification.challanId || selectedVerification._id) ? <RefreshCcw size={16} className="animate-spin" /> : <Check size={16} />} APPROVE
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
