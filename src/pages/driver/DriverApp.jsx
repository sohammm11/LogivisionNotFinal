import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import MobileBottomTabs from '../../components/layout/MobileBottomTabs';
import { Map, Package, Truck, IndianRupee, MapPin, CheckSquare, Camera, Navigation, UserCircle, CheckCircle2, Star, LogOut, Volume2, Bell, Zap } from 'lucide-react';
import { useSocket } from '../../services/SocketProvider';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import StatusPill from '../../components/ui/StatusPill';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Helper: Calculate distance between two coordinates in km
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Helper: Auto-resize map on mount
const MapAutoResize = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Driver Sub-screens
const RouteTab = ({ isLive, toggleLive }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const [stops, setStops] = useState([]);
  const [driverLocation, setDriverLocation] = useState({ lat: 19.1500, lng: 73.0200 });

  // Custom marker icons
  const createStopIcon = (color, number) => {
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-weight: bold;
          font-size: 12px;
          color: white;
        ">
          ${number}
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  // Fetch real stops (Bookings)
  useEffect(() => {
    const fetchStops = async () => {
      try {
        const token = localStorage.getItem('logivision_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch Booking Stops
        const bookingRes = await fetch(`/api/freight/bookings?driverId=${user?._id}&status=ACCEPTED,IN_TRANSIT`, { headers });
        const bookingData = await bookingRes.json();

        // Fetch Challan Stops (Inbound)
        const challanRes = await fetch(`/api/challans?driverId=${user?._id}&status=PENDING`, { headers });
        const challanData = await challanRes.json();

        let allStops = [];

        if (bookingData.success) {
          allStops = [...allStops, ...bookingData.data.bookings.map(book => ({
            id: book._id,
            type: 'OUTBOUND',
            bookingId: book.bookingId,
            address: `${book.deliveryAddress.street}, ${book.deliveryAddress.city}`,
            cargo: book.cargoDescription,
            eta: book.estimatedArrivalTime ? new Date(book.estimatedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD',
            status: book.status === 'IN_TRANSIT' ? 'NEXT' : 'PENDING',
            lat: book.deliveryAddress.coordinates?.lat || 19.2813,
            lng: book.deliveryAddress.coordinates?.lng || 73.0587
          }))];
        }

        if (challanData.success) {
          allStops = [...allStops, ...challanData.data.challans.map(challan => ({
            id: challan._id,
            type: 'INBOUND',
            bookingId: challan.challanId,
            address: `TO: ${challan.deliveryAddress?.city || 'Warehouse'}`,
            cargo: `Inbound Cargo: ${challan.vendorName}`,
            eta: challan.eta ? new Date(challan.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD',
            status: 'PENDING',
            lat: challan.deliveryAddress?.coordinates?.lat || 18.9712,
            lng: challan.deliveryAddress?.coordinates?.lng || 72.9234
          }))];
        }

        setStops(allStops);
      } catch (err) {
        console.error('Error fetching driver stops:', err);
      }
    };

    if (user?._id) fetchStops();
  }, [user]);

  // Live Location Sync
  useEffect(() => {
    if (!socket || !user?._id) return;

    const interval = setInterval(async () => {
      const newLoc = {
        lat: driverLocation.lat + (Math.random() - 0.5) * 0.001,
        lng: driverLocation.lng + (Math.random() - 0.5) * 0.001
      };
      setDriverLocation(newLoc);

      // Persist to API if we have an active stop
      const activeStop = stops.find(s => s.status === 'NEXT') || stops[0];
      if (activeStop) {
        try {
          const token = localStorage.getItem('logivision_token');
          const endpoint = activeStop.type === 'OUTBOUND'
            ? `/api/freight/bookings/${activeStop.id}/location`
            : `/api/challans/${activeStop.bookingId}/location`;

          await fetch(endpoint, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              lat: newLoc.lat,
              lng: newLoc.lng,
              status: activeStop.type === 'OUTBOUND' ? 'IN_TRANSIT' : 'PENDING'
            })
          });
        } catch (err) {
          console.error('Failed to persist location:', err);
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [socket, user, stops, driverLocation]);

  const completedCount = stops.filter(s => s.status === 'DELIVERED').length;
  const routeCoordinates = stops.length > 0 ? stops.map(s => [s.lat, s.lng]) : [[19.0760, 72.8777]];
  const completedSegment = routeCoordinates.slice(0, completedCount + 1);
  const pendingSegment = routeCoordinates.slice(completedCount);

  return (
    <div className="flex flex-col h-full animate-fade-in bg-[#080C14]">
      <div className="h-[calc(100vh-120px)] w-full relative border-b border-[#1E2D45] overflow-hidden">
        <MapContainer
          center={[19.0760, 72.8777]}
          zoom={10}
          style={{ height: '100%', width: '100%', background: '#080C14', position: 'relative' }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapAutoResize />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <Polyline positions={completedSegment} pathOptions={{ color: '#F59E0B', weight: 3 }} />
          <Polyline positions={pendingSegment} pathOptions={{ color: '#3D4F6B', weight: 2, dashArray: '6 6' }} />
          {stops.map((stop, index) => (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createStopIcon(stop.status === 'DELIVERED' ? '#0DD9B0' : (stop.status === 'NEXT' ? '#F59E0B' : '#6B7FA8'), index + 1)}
            />
          ))}
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={L.divIcon({ className: 'bg-[#38BDF8] w-4 h-4 rounded-full border-2 border-white' })} />
        </MapContainer>
        <div className="absolute top-3 right-3 bg-[#111827] border border-[#F59E0B] rounded-md p-2.5 z-[1000] shadow-lg">
          <div className="text-xs text-[#6B7FA8] uppercase tracking-wider mb-1.5 font-bold">{t('ROUTE_PROGRESS')}</div>
          <div className="text-sm text-[#E8F0FE] font-mono-data">{completedCount} {t('OF') || 'of'} {stops.length} {t('STOPS')}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 bg-[#080C14]">
        {stops.map((stop, index) => (
          <div
            key={stop.id}
            onClick={() => stop.status !== 'DELIVERED' && navigate(`/driver/stop/${stop.id}`)}
            className={`bg-[#0D1421] border border-[#1E2D45] rounded-xl p-4 flex gap-4 hover:border-[#F59E0B] transition-all cursor-pointer relative ${stop.status === 'DELIVERED' ? 'opacity-60 grayscale' : 'shadow-lg'}`}
          >
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${stop.status === 'DELIVERED' ? 'bg-[#0DD9B0] text-black' : (stop.status === 'NEXT' ? 'bg-[#F59E0B] text-black' : 'bg-[#1E2D45] text-white')}`}>
                {stop.status === 'DELIVERED' ? <CheckSquare size={16} /> : index + 1}
              </div>
              {index < stops.length - 1 && <div className="w-[2px] h-full bg-[#1E2D45] my-1"></div>}
            </div>
            <div className="flex-1 pt-0.5">
              <div className={`font-bold text-lg mb-1 leading-tight ${stop.status === 'DELIVERED' ? 'line-through text-gray-400' : 'text-white'}`}>
                {stop.address}
              </div>
              <div className="text-[#6B7FA8] text-sm mb-2">{stop.cargo}</div>
              <div className="flex justify-between items-center">
                <span className={`font-mono-data text-sm font-bold ${stop.status === 'NEXT' ? 'text-[#F59E0B]' : 'text-gray-500'}`}>{t('ETA')}: {stop.eta}</span>
                <StatusPill status={stop.status === 'DELIVERED' ? 'COMPLETED' : (stop.status === 'NEXT' ? 'IN TRANSIT' : 'PENDING')} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StopDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [podState, setPodState] = useState('IDLE');

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem('logivision_token');
        const res = await fetch(`/api/freight/bookings/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setBooking(data.data.booking);
        }
      } catch (err) {
        showToast('Error loading booking details', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchBooking();
  }, [id, showToast]);

  const handleDelivery = async () => {
    setPodState('UPLOADING');
    try {
      const token = localStorage.getItem('logivision_token');
      const res = await fetch(`/api/freight/bookings/${id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: 'Delivered via Driver App' })
      });
      const data = await res.json();
      if (data.success) {
        setPodState('SAVED');
        showToast('Proof of Delivery uploaded and job completed!', 'success');
        setTimeout(() => navigate('/driver'), 1500);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setPodState('IDLE');
      showToast(err.message || 'Error completing delivery', 'error');
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-black"><div className="w-8 h-8 rounded-full border-t-2 border-[#F59E0B] animate-spin"></div></div>;
  if (!booking) return <div className="h-full flex items-center justify-center bg-black text-[#6B7FA8]">Booking not found</div>;

  return (
    <div className="flex flex-col h-full bg-[#080C14] animate-[slideInRight_0.3s_ease-out]">
      <div className="p-4 border-b border-[#1E2D45] bg-[#1A2235] flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[#6B7FA8] p-1">&larr; {t('BACK')}</button>
        <h2 className="flex-1 text-center font-bold text-white mr-8 text-lg">{t('STOP_DETAILS')}</h2>
      </div>
      <div className="p-6 space-y-6 flex-1 overflow-auto">
        <div className="text-center">
          <div className="text-[10px] text-[#0DD9B0] font-bold uppercase tracking-widest mb-1">{t('PICKUP_FROM')}</div>
          <h2 className="text-lg font-bold text-white mb-4">{booking.pickupAddress.street}, {booking.pickupAddress.city}</h2>
          <div className="text-[10px] text-[#F59E0B] font-bold uppercase tracking-widest mb-1">{t('DELIVER_TO')}</div>
          <h1 className="text-2xl font-bold text-white mb-2 leading-tight">{booking.deliveryAddress.street}, {booking.deliveryAddress.city}</h1>
          <p className="text-[#6B7FA8] font-mono-data">{t('ETA')}: {booking.estimatedArrivalTime ? new Date(booking.estimatedArrivalTime).toLocaleTimeString() : 'TBD'}</p>
        </div>
        <div className="bg-[#1A2235] border-l-4 border-l-[#F59E0B] p-4 rounded-r-lg space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-400">{t('CARGO')}</span><span className="font-bold text-white">{booking.cargoDescription}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">{t('TOTAL_WEIGHT')}</span><span className="font-mono-data text-white font-bold">{booking.weightKg} KG</span></div>
          <div className="pt-3 border-t border-[#1E2D45]"><span className="text-xs text-[#F59E0B] uppercase font-bold tracking-wider block mb-1">{t('INSTRUCTIONS')}</span><p className="text-sm text-gray-300">{booking.notes || 'No special instructions.'}</p></div>
        </div>
        <button onClick={() => showToast('Navigation starting...', 'info')} className="w-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-black font-bold py-4 rounded-lg flex items-center justify-center gap-2"><Navigation size={20} /> {t('NAVIGATE')}</button>
        {podState === 'IDLE' ? (
          <button onClick={handleDelivery} className="w-full border-2 border-[#0DD9B0] text-[#0DD9B0] font-bold py-4 rounded-lg flex items-center justify-center gap-2 mt-4"><Camera size={20} /> {t('MARK_DELIVERED')}</button>
        ) : (
          <div className="w-full bg-[#1A2235] py-4 rounded-lg flex items-center justify-center gap-3 mt-4">
            <span className="text-[#0DD9B0] font-bold">{podState === 'UPLOADING' ? 'UPLOADING...' : 'DELIVERED'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const FreightTab = ({ isLive, toggleLive }) => {
  const { addToast: showToast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [truck, setTruck] = useState(null);
  const [incomingJobs, setIncomingJobs] = useState([]);
  const [marketStats, setMarketStats] = useState({ averageMonthlyRate: 45, totalMarketBookings: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const CARGO_CATEGORIES = [
    { id: 'ELECTRONICS', label: 'Electronics', color: '#38BDF8' },
    { id: 'FMCG', label: 'FMCG', color: '#F59E0B' },
    { id: 'AUTO_PARTS', label: 'Auto Parts', color: '#F43F5E' },
    { id: 'PHARMA', label: 'Pharma', color: '#0DD9B0' },
    { id: 'TEXTILES', label: 'Textiles', color: '#A855F7' },
    { id: 'GENERAL', label: 'Any Cargo', color: '#6B7FA8' }
  ];

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const token = localStorage.getItem('logivision_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Fetch My Truck State
        const truckRes = await fetch(`/api/freight/my-truck`, { headers });
        const truckData = await truckRes.json();
        if (truckData.success) {
          setTruck(truckData.data.truck);
        }

        // 2. Fetch Market Stats
        const statsRes = await fetch(`/api/freight/market/stats`, { headers });
        const statsData = await statsRes.json();
        if (statsData.success) {
          setMarketStats(statsData.data);
        }

        // 3. Fetch Available/Pending Market Jobs
        const jobsRes = await fetch(`/api/freight/bookings?driverId=${user?._id}&status=PENDING`, { headers });
        const jobsData = await jobsRes.json();
        if (jobsData.success) {
          setIncomingJobs(jobsData.data.bookings);
        }
      } catch (err) {
        console.error('Market fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?._id) fetchMarketData();
  }, [user]);

  // Real-time socket listener for new jobs
  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleNewFreight = (data) => {
      if (data.booking.driverId?._id === user?._id || data.booking.driverId === user?._id) {
        setIncomingJobs(prev => [data.booking, ...prev.filter(j => j._id !== data.booking._id)]);
        showToast(`New request from ${data.booking.createdBy?.name || 'Manager'}!`, 'info');
      }
    };

    socket.on('freight:available', handleNewFreight);
    return () => socket.off('freight:available');
  }, [socket, user, showToast]);

  const updateMarketStatus = async (updates) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('logivision_token');
      const res = await fetch(`/api/freight/my-truck/market`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setTruck(data.data.truck);
        showToast('Market availability updated!', 'success');
      }
    } catch (err) {
      showToast('Update failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleCargo = (category) => {
    const current = truck?.cargoPreferences || [];
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    updateMarketStatus({ cargoPreferences: updated });
  };

  const handleLoadChange = (e) => {
    const val = parseInt(e.target.value);
    setTruck(prev => {
      if (!prev) return prev;
      return { ...prev, currentLoadKg: val, availableCapacityPercent: 100 - (val / prev.totalCapacityKg * 100) };
    });
  };

  const handleAcceptJob = async (jobId) => {
    try {
      const token = localStorage.getItem('logivision_token');
      const res = await fetch(`/api/freight/bookings/${jobId}/accept`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedArrivalTime: new Date(Date.now() + 3600 * 1000) })
      });

      if (res.ok) {
        showToast('Job accepted! Moving to your route.', 'success');
        navigate('/driver');
      }
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#080C14]">
      <div className="w-10 h-10 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#080C14] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] shrink-0">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Truck className="text-[#F59E0B]" /> {t('FREIGHT_MARKET')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Capacity Overview */}
        <div className="text-center py-4 bg-[#0D1421]/50 rounded-2xl border border-[#1E2D45] relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-mono-data font-black text-[#F59E0B] tracking-tighter">
              {truck ? (truck.availableCapacityPercent || 0).toFixed(0) : 100}% {t('CAPACITY_FREE')}
            </h1>
            <p className="text-[#6B7FA8] text-[10px] mt-1 uppercase tracking-widest font-bold">
              Broadcast availability to earn more
            </p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#F59E0B]/5 to-transparent"></div>
        </div>

        {/* Vehicle Load Card */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-[#38BDF8]/10 flex items-center justify-center text-[#38BDF8]">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{t('VEHICLE_LOAD_STATUS')}</h3>
              <p className="text-[10px] text-[#6B7FA8] uppercase font-bold tracking-widest">Total: {truck?.totalCapacityKg || 0} KG</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[#E8F0FE] text-xs font-bold">{t('CURRENT_LOAD')}:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={truck?.currentLoadKg || 0}
                    onChange={(e) => updateMarketStatus({ currentLoadKg: parseInt(e.target.value) })}
                    className="w-20 bg-[#080C14] border border-[#1E2D45] rounded px-2 py-1 text-right text-[#F59E0B] font-mono-data text-xs"
                  />
                  <span className="text-[#6B7FA8] font-bold text-[10px]">KG</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={truck?.totalCapacityKg || 25000}
                value={truck?.currentLoadKg || 0}
                onChange={handleLoadChange}
                onMouseUp={() => truck && updateMarketStatus({ currentLoadKg: truck.currentLoadKg })}
                onTouchEnd={() => truck && updateMarketStatus({ currentLoadKg: truck.currentLoadKg })}
                className="w-full accent-[#38BDF8] h-1.5 bg-[#1E2D45] rounded-full appearance-none cursor-pointer"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-[#0DD9B0]">{t('AVAILABLE')}: {(truck?.totalCapacityKg || 0) - (truck?.currentLoadKg || 0)} KG</span>
                <span className="text-[10px] font-bold text-[#6B7FA8]">{(100 - (truck?.availableCapacityPercent || 0)).toFixed(1)}% {t('USED')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Strategy Card */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-[#0DD9B0]/10 flex items-center justify-center text-[#0DD9B0]">
              <IndianRupee size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{t('PRICING_STRATEGY')}</h3>
              <p className="text-[10px] text-[#6B7FA8] uppercase font-bold tracking-widest">Optimize your earnings</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#080C14] p-4 rounded-xl border border-[#1E2D45] flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{t('RATE_PER_KM')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[#F59E0B] font-bold">₹</span>
                  <input
                    type="number"
                    value={truck?.pricePerKm || 0}
                    onChange={(e) => setTruck(prev => ({ ...prev, pricePerKm: parseInt(e.target.value) }))}
                    onBlur={(e) => updateMarketStatus({ pricePerKm: parseInt(e.target.value) })}
                    className="w-16 bg-transparent border-none text-2xl font-mono-data font-black text-[#F59E0B] focus:ring-0 p-0"
                  />
                </div>
              </div>
              <div className="text-right">
                <div className={`text-[9px] font-black px-2 py-0.5 rounded-full inline-block mb-1 ${(truck?.pricePerKm || 0) <= marketStats.averageMonthlyRate
                  ? 'bg-[#0DD9B0]/10 text-[#0DD9B0]'
                  : 'bg-[#F43F5E]/10 text-[#F43F5E]'
                  }`}>
                  {(truck?.pricePerKm || 0) <= marketStats.averageMonthlyRate ? t('COMPETITIVE') : t('PREMIUM_RATE')}
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">MKT AVG: ₹{marketStats.averageMonthlyRate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Specialized cargo details */}
        <div className="space-y-3">
          <h3 className="text-[#6B7FA8] text-[10px] font-bold uppercase tracking-[0.2em] ml-2">{t('MARKET_DESCRIPTION')}</h3>
          <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-4 shadow-xl">
            <textarea
              placeholder="Tell managers about your specialization... (e.g., 'Expert in fragile glass transport')"
              value={truck?.cargoDescription || ''}
              onChange={(e) => setTruck(prev => ({ ...prev, cargoDescription: e.target.value }))}
              onBlur={(e) => updateMarketStatus({ cargoDescription: e.target.value })}
              className="w-full bg-[#080C14] border border-[#1E2D45] rounded-xl p-3 text-xs text-white placeholder:text-gray-600 focus:border-[#F59E0B] transition-all min-h-[80px]"
            />
          </div>
        </div>

        {/* Preferred Cargo */}
        <div className="space-y-3">
          <h3 className="text-[#6B7FA8] text-[10px] font-bold uppercase tracking-[0.2em] ml-2">{t('PREFERRED_CARGO')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {CARGO_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleToggleCargo(cat.id)}
                disabled={updating}
                className={`py-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${truck?.cargoPreferences?.includes(cat.id)
                  ? 'bg-[#1A2235] border-[#F59E0B] shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-[1.02]'
                  : 'bg-[#0D1421] border-[#1E2D45] opacity-50'
                  }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: truck?.cargoPreferences?.includes(cat.id) ? cat.color : '#4B5563' }}
                ></div>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${truck?.cargoPreferences?.includes(cat.id) ? 'text-white' : 'text-[#6B7FA8]'}`}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <h3 className="text-[#F59E0B] text-[10px] font-bold uppercase tracking-[0.2em]">{t('LIVE_JOB_MARKETPLACE')}</h3>
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0DD9B0] animate-pulse"></span>
              <span className="text-[9px] text-[#0DD9B0] font-bold">ONLINE</span>
            </div>
          </div>

          <div className="space-y-4">
            {incomingJobs.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-[#1E2D45] rounded-3xl flex flex-col items-center justify-center opacity-40">
                <Package size={32} className="text-[#6B7FA8] mb-3" />
                <p className="text-xs text-[#6B7FA8] font-bold">Waiting for booking requests...</p>
              </div>
            ) : (
              incomingJobs.map(job => (
                <div key={job._id} className="bg-[#1A2235] rounded-2xl p-5 border border-[#1E2D45] shadow-2xl animate-[slideInUp_0.4s_ease-out] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 px-4 py-1 bg-[#F59E0B] text-black text-[10px] font-black uppercase tracking-tighter rounded-bl-xl z-10 shadow-lg">
                    HOT REQUEST
                  </div>

                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-[#0DD9B0] font-bold uppercase tracking-widest">{job.createdBy?.name || 'Manager'}</span>
                        <span className="text-[10px] text-[#6B7FA8]">wants your service</span>
                      </div>
                      <h4 className="text-white font-bold text-lg leading-tight uppercase">{job.cargoDescription}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono-data font-black text-[#F59E0B]">₹{job.totalCost?.toLocaleString()}</div>
                      <div className="text-[9px] text-[#6B7FA8] font-bold uppercase">Estimated Pay</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-[#080C14]/50 p-4 rounded-xl border border-[#1E2D45] mb-6">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-[#F59E0B]"></div>
                      <div className="w-px h-6 bg-gradient-to-b from-[#F59E0B] to-[#0DD9B0]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0DD9B0]"></div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">From</div>
                        <div className="text-white text-xs font-bold truncate">{job.pickupAddress?.city || 'Origin'}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Deliver To</div>
                        <div className="text-white text-xs font-bold truncate">{job.deliveryAddress?.city || 'Destination'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-[#080C14] p-3 rounded-xl border border-[#1E2D45] text-center">
                      <div className="text-[9px] text-gray-500 font-bold uppercase">Weight</div>
                      <div className="text-white text-sm font-mono-data font-bold">{job.weightKg} KG</div>
                    </div>
                    <div className="flex-1 bg-[#080C14] p-3 rounded-xl border border-[#1E2D45] text-center">
                      <div className="text-[9px] text-gray-500 font-bold uppercase">Dist.</div>
                      <div className="text-white text-sm font-mono-data font-bold">{job.distanceKm} KM</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAcceptJob(job._id)}
                    className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-black font-black py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(245,158,11,0.2)] text-xs uppercase tracking-widest active:scale-95"
                  >
                    ACCEPT AND BOOK TRUCK
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* STICKY GO LIVE BUTTON AT BOTTOM */}
      <div className="p-4 bg-[#080C14] border-t border-[#1E2D45] shrink-0">
        <button
          onClick={toggleLive}
          className={`w-full py-4 rounded-lg font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 ${
            isLive ? 'bg-[#059669] text-white' : 'bg-[#1E2D45] text-gray-400'
          }`}
        >
          {isLive && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
          {isLive ? 'GO LIVE' : 'GO OFFLINE'}
        </button>
      </div>
    </div>
  );
};

const EarningsTab = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState({ total: 0, transactions: [] });

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const token = localStorage.getItem('logivision_token');
        const res = await fetch(`/api/freight/bookings?driverId=${user?._id}&status=COMPLETED`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const total = data.data.bookings.reduce((acc, b) => acc + (b.totalCost || 0), 0);
          setEarnings({ total, transactions: data.data.bookings });
        }
      } catch (err) { console.error(err); }
    };
    if (user?._id) fetchEarnings();
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-[#080C14]">
      <div className="p-8 bg-[#1A2235] border-b border-[#F59E0B] text-center">
        <h2 className="text-xs font-bold text-gray-400 uppercase mb-2">Total Earnings</h2>
        <div className="text-4xl font-mono-data font-bold text-[#F59E0B]">₹{earnings.total.toLocaleString()}</div>
      </div>
      <div className="p-4 flex-1 overflow-auto space-y-4">
        {earnings.transactions.map(t => (
          <div key={t._id} className="bg-[#0D1421] border border-[#1E2D45] p-4 rounded-xl flex justify-between items-center">
            <div><div className="font-bold text-white">{t.deliveryAddress.city} trip</div><div className="text-xs text-gray-500">{new Date(t.updatedAt).toLocaleDateString()}</div></div>
            <div className="text-[#0DD9B0] font-bold">₹{t.totalCost}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DriverProfileTab = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { addToast: showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  const [personalEditing, setPersonalEditing] = useState(false);
  const [vehicleEditing, setVehicleEditing] = useState(false);
  
  const [personalData, setPersonalData] = useState({ name: '', email: '', phone: '' });
  const [vehicleData, setVehicleData] = useState({ vehicle_plate: '', vehicle_type: 'Medium Truck', capacity_tonnes: 0, preferred_routes: '' });
  const [shiftData, setShiftData] = useState({ shift_start: '--:--', shift_end: '--:--', entriesToday: 0, totalTrips: 0 });

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const token = localStorage.getItem('logivision_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch current user from API to get all fields
        const meRes = await fetch('/api/auth/me', { headers });
        let userData = user;
        if (meRes.ok) {
           const meData = await meRes.json();
           if (meData.success && meData.data?.user) {
               userData = meData.data.user;
           }
        }
        
        setPersonalData({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || ''
        });
        
        setVehicleData({
            vehicle_plate: userData.vehicle_plate || '',
            vehicle_type: userData.vehicle_type || 'Medium Truck',
            capacity_tonnes: userData.capacity_tonnes || 0,
            preferred_routes: userData.preferred_routes || ''
        });
        
        // Fetch Shift & Trip Data
        const bookingsRes = await fetch(`/api/freight/bookings?driverId=${user?._id}`, { headers });
        let deliveriesTodayCount = 0;
        let totalTripsCount = 0;
        
        if (bookingsRes.ok) {
            const bookingsData = await bookingsRes.json();
            if (bookingsData.success) {
                const bookings = bookingsData.data.bookings;
                const today = new Date().setHours(0, 0, 0, 0);
                const completedToday = bookings.filter(b => b.status === 'COMPLETED' && new Date(b.completedAt) >= today);
                deliveriesTodayCount = completedToday.length;
                totalTripsCount = bookings.filter(b => b.status === 'COMPLETED').length;
            }
        }

        // Try to fetch entries
        let entriesTodayCount = deliveriesTodayCount; // fallback
        try {
            const entriesRes = await fetch(`/api/entries?driverId=${user?._id}`, { headers });
            if (entriesRes.ok) {
                const entriesData = await entriesRes.json();
                if (entriesData.success) {
                   const today = new Date().setHours(0, 0, 0, 0);
                   entriesTodayCount = entriesData.data.entries.filter(e => new Date(e.timestamp) >= today).length;
                }
            }
        } catch (e) {}

        setShiftData({
            shift_start: userData.shift_start || '--:--',
            shift_end: userData.shift_end || '--:--',
            entriesToday: entriesTodayCount,
            totalTrips: totalTripsCount
        });

      } catch (err) {
        console.error('Fetch profile failed', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?._id) fetchRealData();
  }, [user]);

  const handleUpdateProfile = async (type) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('logivision_token');
      const payload = type === 'personal' ? personalData : vehicleData;
      
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        updateUser(data.data.user);
        showToast('Profile updated successfully', 'success');
        if (type === 'personal') setPersonalEditing(false);
        if (type === 'vehicle') setVehicleEditing(false);
      } else {
        showToast(data.message || 'Update failed', 'error');
      }
    } catch (err) {
      showToast('Connection error during update', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const updateLanguage = async (newLang) => {
    try {
      setLanguage(newLang);
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('logivision_token')}` },
        body: JSON.stringify({ language: newLang })
      });
      const data = await res.json();
      if(data.success) {
        updateUser({ language: newLang });
        showToast('Language updated', 'success');
      }
    } catch(err) {
      console.error('Lang update failed', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#080C14] h-full">
      <div className="w-10 h-10 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#080C14]">
      {/* Profile Header */}
      <div className="pt-12 pb-8 px-6 flex flex-col items-center bg-gradient-to-b from-[#111827] to-[#080C14] border-b border-[#1E2D45]">
        <div className="w-24 h-24 rounded-full border-2 border-[#38BDF8] p-1 mb-4 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
          <div className="w-full h-full rounded-full bg-[#111827] flex items-center justify-center overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <UserCircle size={60} className="text-[#3D4F6B]" />
            )}
          </div>
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-widest">{personalData.name || 'LOGIVISION DRIVER'}</h2>
        <div className="text-[10px] text-[#38BDF8] font-black uppercase tracking-widest mt-1 opacity-70">Logistics Partner</div>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-24 hide-scrollbar">
        
        {/* Personal Info */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1E2D45] pb-3 mb-2">
            <div className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">Personal Info</div>
            {!personalEditing ? (
                <button onClick={() => setPersonalEditing(true)} className="text-[10px] text-[#38BDF8] font-black uppercase hover:underline">Edit</button>
            ) : null}
          </div>
          
          {personalEditing ? (
             <div className="space-y-4">
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Name</label>
                  <input type="text" value={personalData.name} onChange={e => setPersonalData({...personalData, name: e.target.value})} className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#38BDF8] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Email</label>
                  <input type="email" value={personalData.email} onChange={e => setPersonalData({...personalData, email: e.target.value})} className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#38BDF8] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Phone Number</label>
                  <input type="text" value={personalData.phone} onChange={e => setPersonalData({...personalData, phone: e.target.value})} className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#38BDF8] outline-none" />
                </div>
                <div className="flex gap-2 pt-2">
                   <button onClick={() => handleUpdateProfile('personal')} disabled={updating} className="flex-1 bg-[#38BDF8] text-black text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider">{updating ? 'Saving...' : 'Save'}</button>
                   <button onClick={() => setPersonalEditing(false)} className="flex-1 border border-[#1E2D45] text-[#6B7FA8] text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider">Cancel</button>
                </div>
             </div>
          ) : (
             <div className="space-y-3 pt-1">
                <div>
                  <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Name</div>
                  <div className="text-sm font-bold text-white">{personalData.name || '-'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Email</div>
                  <div className="text-sm font-bold text-white max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{personalData.email || '-'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Phone Number</div>
                  <div className="text-sm font-bold text-white">{personalData.phone || '-'}</div>
                </div>
             </div>
          )}
        </div>

        {/* Vehicle Info */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1E2D45] pb-3 mb-2">
            <div className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">Vehicle Info</div>
            {!vehicleEditing ? (
                <button onClick={() => setVehicleEditing(true)} className="text-[10px] text-[#38BDF8] font-black uppercase hover:underline">Edit</button>
            ) : null}
          </div>
          
          {vehicleEditing ? (
             <div className="space-y-4 pt-1">
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Vehicle Number Plate</label>
                  <input type="text" value={vehicleData.vehicle_plate} onChange={e => setVehicleData({...vehicleData, vehicle_plate: e.target.value})} className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white font-mono-data text-sm focus:border-[#38BDF8] outline-none uppercase" />
                </div>
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Vehicle Type</label>
                  <select value={vehicleData.vehicle_type} onChange={e => setVehicleData({...vehicleData, vehicle_type: e.target.value})} className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#38BDF8] outline-none">
                    <option value="Mini Truck">Mini Truck</option>
                    <option value="Medium Truck">Medium Truck</option>
                    <option value="Heavy Truck">Heavy Truck</option>
                    <option value="Trailer">Trailer</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Capacity (Tonnes)</label>
                  <input type="number" value={vehicleData.capacity_tonnes} onChange={e => setVehicleData({...vehicleData, capacity_tonnes: Number(e.target.value)})} className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#38BDF8] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-widest block mb-1">Preferred Routes</label>
                  <input type="text" value={vehicleData.preferred_routes} onChange={e => setVehicleData({...vehicleData, preferred_routes: e.target.value})} placeholder="e.g. Mumbai - Pune" className="w-full bg-[#080C14] border border-[#1E2D45] rounded-lg px-3 py-2 text-white text-sm focus:border-[#38BDF8] outline-none" />
                </div>
                <div className="flex gap-2 pt-2">
                   <button onClick={() => handleUpdateProfile('vehicle')} disabled={updating} className="flex-1 bg-[#38BDF8] text-black text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider">{updating ? 'Saving...' : 'Save'}</button>
                   <button onClick={() => setVehicleEditing(false)} className="flex-1 border border-[#1E2D45] text-[#6B7FA8] text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider">Cancel</button>
                </div>
             </div>
          ) : (
             <div className="space-y-3 pt-1">
                <div>
                  <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Vehicle Number Plate</div>
                  <div className="text-sm font-bold font-mono-data text-white">{vehicleData.vehicle_plate || '-'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Vehicle Type</div>
                  <div className="text-sm font-bold text-white">{vehicleData.vehicle_type || '-'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Capacity</div>
                      <div className="text-sm font-bold text-white">{vehicleData.capacity_tonnes ? `${vehicleData.capacity_tonnes} Tonnes` : '-'}</div>
                    </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Preferred Routes</div>
                  <div className="text-sm font-bold text-white">{vehicleData.preferred_routes || '-'}</div>
                </div>
             </div>
          )}
        </div>
        
        {/* Shift Info */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 space-y-4">
          <div className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#1E2D45] pb-3 mb-2">Shift Info</div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-4 pt-1">
             <div>
               <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Shift Start</div>
               <div className="text-sm font-bold text-[#38BDF8]">{shiftData.shift_start}</div>
             </div>
             <div>
               <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Shift End</div>
               <div className="text-sm font-bold text-[#F43F5E]">{shiftData.shift_end}</div>
             </div>
             <div>
               <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Total Entries Today</div>
               <div className="text-sm font-bold font-mono-data text-white">{shiftData.entriesToday}</div>
             </div>
             <div>
               <div className="text-[9px] text-[#6B7FA8] font-black uppercase mb-0.5">Total Trips Completed</div>
               <div className="text-sm font-bold font-mono-data text-white">{shiftData.totalTrips}</div>
             </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 space-y-4">
           <div className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#1E2D45] pb-3 mb-2">{t('LANGUAGE')}</div>
           <div className="flex gap-2">
              {[
                { id: 'en', label: 'English' },
                { id: 'hi', label: 'हिंदी' },
                { id: 'mr', label: 'मराठी' }
              ].map((lang) => (
                <button 
                  key={lang.id}
                  onClick={() => updateLanguage(lang.id)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === lang.id ? 'bg-[#F59E0B] text-black shadow-lg shadow-[#F59E0B]/20 border-transparent' : 'bg-[#0D1421] text-[#6B7FA8] border border-[#1E2D45]'}`}
                >
                  {lang.label}
                </button>
              ))}
           </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-4">
          <button
            onClick={handleLogout}
            className="w-full bg-[#0D1421] border border-[#F43F5E] text-[#F43F5E] font-black py-4 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#F43F5E]/10 active:scale-95 transition-all shadow-[0_0_15px_rgba(244,63,94,0.15)]"
          >
            <LogOut size={16} /> {t('LOGOUT')}
          </button>
        </div>
      </div>
    </div>
  );
};

const DriverApp = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [isLive, setIsLive] = useState(false);

  const toggleLive = () => {
    const newState = !isLive;
    setIsLive(newState);
    if (newState) {
      if (socket) {
        socket.emit('driver:live', { 
          driverId: user._id, 
          driverName: user.name, 
          location: { lat: 18.6529, lng: 73.7276 }, 
          status: 'available', 
          rate: 38, 
          vehicle: 'Truck', 
          capacity: 20, 
          timestamp: Date.now() 
        });
      }
    } else {
      if (socket) {
        socket.emit('driver:offline', { 
          driverId: user._id, 
          status: 'offline' 
        });
      }
    }
  };

  const { t } = useLanguage();
  const TABS = [
    { id: 'freight', label: t('FREIGHT') || 'FREIGHT', path: '/driver/freight', icon: Package, exact: false },
    { id: 'earnings', label: t('EARNINGS') || 'EARNINGS', path: '/driver/earnings', icon: IndianRupee, exact: false },
    { id: 'route', label: t('ROUTE') || 'ROUTE', path: '/driver/route', icon: Map, exact: true },
    { id: 'profile', label: t('PROFILE'), path: '/driver/profile', icon: UserCircle, exact: false },
  ];

  return (
    <div className='max-w-sm mx-auto min-h-screen bg-[#080C14] relative overflow-x-hidden border-x border-[#1E2D45] shadow-2xl'>
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Navigate to="/driver/freight" replace />} />
            <Route path="/route" element={<RouteTab isLive={isLive} toggleLive={toggleLive} />} />
            <Route path="/stop/:id" element={<StopDetail />} />
            <Route path="/freight" element={<FreightTab isLive={isLive} toggleLive={toggleLive} />} />
            <Route path="/earnings" element={<EarningsTab />} />
            <Route path="/profile" element={<DriverProfileTab />} />
            <Route path="*" element={<Navigate to="/driver/freight" replace />} />
          </Routes>
        </div>
        <div className="h-[80px] shrink-0"></div>
        <MobileBottomTabs tabs={TABS} />
      </div>
    </div>
  );
};

export default DriverApp;
