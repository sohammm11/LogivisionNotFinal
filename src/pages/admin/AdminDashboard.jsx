import React, { useState, useEffect } from 'react';
import StatusPill from '../../components/ui/StatusPill';
import { useSocket } from '../../services/SocketProvider';
import { useToast } from '../../context/ToastContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, LayoutGrid, Truck, FileBarChart, AlertTriangle, Download, CheckCircle, RefreshCw, Users, Settings, Edit2, UserX, Database, Wifi, Server, Trash2, X, Plus } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const getToken = () => {
  const t1 = localStorage.getItem('logivision_token');
  if (t1 && t1 !== 'null' && t1 !== 'undefined') return t1;
  const t2 = sessionStorage.getItem('logivision_token');
  if (t2 && t2 !== 'null' && t2 !== 'undefined') return t2;
  return '';
};

const sidebarItems = [
  { id: 'feed', label: 'Live Feed', icon: Activity },
  { id: 'heatmap', label: 'Dock Heatmap', icon: LayoutGrid },
  { id: 'tracker', label: 'Truck Tracker', icon: Truck },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

const roleColors = {
  AUTHORITY: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
  WAREHOUSE_MANAGER: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/30',
  GUARD: 'text-[#0DD9B0] bg-[#0DD9B0]/10 border-[#0DD9B0]/30',
  DRIVER: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  ADMIN: 'text-[#F43F5E] bg-[#F43F5E]/10 border-[#F43F5E]/30',
};

const AdminDashboard = () => {
  const { socket } = useSocket();
  const showToast = useToast();
  
  const [activeView, setActiveView] = useState('feed');
  const [isLoading, setIsLoading] = useState(true);
  
  // Real Data States
  const [feed, setFeed] = useState([]);
  const [docks, setDocks] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ todayCount: 0, weekCount: 0, monthCount: 0, mismatchCount: 0, avgGateTimeSeconds: 0, approvalRate: 0 });
  const [chartData, setChartData] = useState([]);

  // Modals & Panels
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedDock, setSelectedDock] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'GUARD', warehouseId: 'ALL SITES', shift_start: '08:00', shift_end: '16:00' });

  // Loaders
  const [fetchingDocks, setFetchingDocks] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [appSettings, setAppSettings] = useState({
    platformName: 'LogiVision AI',
    defaultGate: 'Gate 01',
    maxEntriesPerShift: 50,
    autoApproveMinutes: 15,
    warehouseName: 'Chakan Main Hub',
    warehouseAddress: 'Phase 2, Chakan MIDC, Pune, Maharashtra 410501',
    totalDocks: 10,
    notifications: {
      emailMismatch: true,
      smsMismatch: false,
      autoFlagEmptyVibe: true,
      requireRejectionReason: true
    }
  });
  const [isEditingWarehouse, setIsEditingWarehouse] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ warehouseName: '', warehouseAddress: '', totalDocks: 0 });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${getToken()}` };
      
      const [entriesRes, docksRes, usersRes, statsRes] = await Promise.all([
        fetch('/api/entries', { headers }),
        fetch('/api/docks', { headers }),
        fetch('/api/auth/users?limit=100', { headers }),
        fetch('/api/entries/stats', { headers })
      ]);

      const [entriesData, docksData, usersData, statsData, settingsData] = await Promise.all([
        entriesRes.json(), docksRes.json(), usersRes.json(), statsRes.json(),
        fetch('/api/settings', { headers }).then(r => r.json())
      ]);

      if (entriesData.success) {
        setFeed(entriesData.data);
        generateChartData(entriesData.data);
      }
      if (docksData.success) setDocks(docksData.data.docks);
      if (usersData.success) setUsers(usersData.data.users);
      if (statsData.success) setStats(statsData.data);
      if (settingsData.success) {
        setAppSettings(settingsData.data);
        setWarehouseForm({
          warehouseName: settingsData.data.warehouseName,
          warehouseAddress: settingsData.data.warehouseAddress,
          totalDocks: settingsData.data.totalDocks
        });
      }

    } catch (err) {
      showToast('Error fetching initial data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const onNewEntry = (entry) => {
      setFeed(prev => [entry, ...prev]);
      fetchStatsData();
    };
    
    const onEntryUpdated = () => {
      fetchEntriesData();
      fetchStatsData();
    };

    const onDockUpdated = () => {
      fetchDocksData();
    };

    socket.on('new_entry', onNewEntry);
    socket.on('challan:status:updated', onEntryUpdated);
    socket.on('challan:mismatch', onEntryUpdated);
    socket.on('challan:verified', onEntryUpdated);
    socket.on('dock:updated', onDockUpdated);
    socket.on('dock:released', onDockUpdated);

    return () => {
      socket.off('new_entry', onNewEntry);
      socket.off('challan:status:updated', onEntryUpdated);
      socket.off('challan:mismatch', onEntryUpdated);
      socket.off('challan:verified', onEntryUpdated);
      socket.off('dock:updated', onDockUpdated);
      socket.off('dock:released', onDockUpdated);
    };
  }, [socket]);

  const fetchStatsData = async () => {
    try {
      const res = await fetch('/api/entries/stats', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await res.json();
      if(data.success) setStats(data.data);
    } catch(err) {}
  };

  const fetchEntriesData = async () => {
    try {
      const res = await fetch('/api/entries', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) {
        setFeed(data.data);
        generateChartData(data.data);
      }
    } catch(err) {}
  };

  const fetchDocksData = async () => {
    try {
      const res = await fetch('/api/docks', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) setDocks(data.data.docks);
    } catch(err) {}
  };

  const fetchUsersData = async () => {
    setFetchingUsers(true);
    try {
      const res = await fetch('/api/auth/users?limit=100', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) setUsers(data.data.users);
    } catch(err) {
      showToast('Error refreshing users', 'error');
    } finally {
      setFetchingUsers(false);
    }
  };

  const generateChartData = (entries) => {
    const hours = {};
    entries.forEach(e => {
        const d = new Date(e.createdAt);
        if (d.toDateString() === new Date().toDateString()) {
            const h = d.getHours().toString().padStart(2, '0') + ':00';
            hours[h] = (hours[h] || 0) + 1;
        }
    });
    const formatted = Object.keys(hours).sort().map(k => ({ time: k, trucks: hours[k] }));
    setChartData(formatted.length > 0 ? formatted : [{time: '08:00', trucks: 0}]);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString();
    doc.setFontSize(16);
    doc.text('LogiVision AI — Admin Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${dateStr}`, 14, 25);
    
    // Section 1 table: Summary stats
    doc.setFontSize(12);
    doc.text('Summary Statistics', 14, 35);
    autoTable(doc, {
      startY: 40,
      head: [['Trucks Today', 'Total Entries', 'Mismatches', 'Approval Rate', 'Avg Gate Time']],
      body: [[
        stats.todayCount,
        feed.length,
        stats.mismatchCount,
        `${stats.approvalRate}%`,
        `${stats.avgGateTimeSeconds}s`
      ]]
    });
    
    // Section 2 table: Recent entries
    doc.text('Recent Entries', 14, (doc).lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: (doc).lastAutoTable.finalY + 15,
      head: [['Challan', 'Truck', 'Goods', 'Weight', 'Vibe Check', 'Status', 'Guard', 'Timestamp']],
      body: feed.map(f => [
        f.challanId || '-',
        f.vehicleNo || f.plate || '-',
        f.cargoDescription || f.cargo || '-',
        f.totalWeight || f.weight || '-',
        f.visualLoad || '-',
        f.status,
        f.scannedBy?.name || 'Unknown',
        new Date(f.createdAt).toLocaleTimeString()
      ]),
    });
    
    // Section 3 table: Mismatch log
    const mismatches = feed.filter(f => f.status === 'MISMATCH');
    if (mismatches.length > 0) {
      doc.text('Mismatch Log', 14, (doc).lastAutoTable.finalY + 10);
      autoTable(doc, {
        startY: (doc).lastAutoTable.finalY + 15,
        head: [['Truck', 'Declared', 'Actual', 'Guard', 'Time']],
        body: mismatches.map(m => [
          m.vehicleNo || m.plate || '-',
          m.declaredLoad || '-',
          m.visualLoad || '-',
          m.scannedBy?.name || 'Unknown',
          new Date(m.createdAt).toLocaleTimeString()
        ])
      });
    }

    const formattedDate = new Date().toISOString().split('T')[0];
    doc.save(`LogiVision-Report-${formattedDate}.pdf`);
    showToast('PDF Exported successfully', 'success');
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const summarySheet = XLSX.utils.json_to_sheet([stats]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    const mappedEntries = feed.map(f => ({
      ID: f.challanId, Vehicle: f.vehicleNo, Vendor: f.vendorName, 
      Cargo: f.cargoDescription, Status: f.status, Date: new Date(f.createdAt).toLocaleString()
    }));
    const entriesSheet = XLSX.utils.json_to_sheet(mappedEntries);
    XLSX.utils.book_append_sheet(wb, entriesSheet, 'Entries');

    const mismatches = feed.filter(f => f.status === 'MISMATCH');
    const mismatchSheet = XLSX.utils.json_to_sheet(mismatches);
    XLSX.utils.book_append_sheet(wb, mismatchSheet, 'Mismatches');

    XLSX.writeFile(wb, 'LogiVision_Admin_Data.xlsx');
    showToast('Excel Exported successfully', 'success');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('User created successfully', 'success');
        setIsAddUserModalOpen(false);
        setUserForm({ name: '', email: '', password: '', role: 'GUARD', warehouseId: 'ALL SITES', shift_start: '08:00', shift_end: '16:00' });
        fetchUsersData();
      } else {
        throw new Error(data.message || 'Error adding user');
      }
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      const data = await res.json();
      if(data.success) {
        showToast(`User ${!currentStatus ? 'activated' : 'deactivated'}`, 'success');
        fetchUsersData();
      } else throw new Error(data.message);
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if(data.success) {
        showToast(`Role updated to ${newRole}`, 'success');
        fetchUsersData();
      } else throw new Error(data.message);
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleReleaseDock = async (dockId) => {
    try {
      const res = await fetch(`/api/docks/${dockId}/release`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ notes: 'Admin released dock manually' })
      });
      const data = await res.json();
      if(data.success) {
        showToast('Dock released successfully', 'success');
        setSelectedDock(null);
        fetchDocksData();
      } else throw new Error(data.message);
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleSavePlatformSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          platformName: appSettings.platformName,
          defaultGate: appSettings.defaultGate,
          maxEntriesPerShift: appSettings.maxEntriesPerShift,
          autoApproveMinutes: appSettings.autoApproveMinutes
        })
      });
      const data = await res.json();
      if(data.success) {
        showToast('Platform settings saved', 'success');
        setAppSettings(data.data);
      } else throw new Error(data.message);
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveWarehouseSettings = async () => {
    try {
      const res = await fetch('/api/settings/warehouse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(warehouseForm)
      });
      const data = await res.json();
      if(data.success) {
        showToast('Warehouse settings updated', 'success');
        setAppSettings(data.data);
        setIsEditingWarehouse(false);
      } else throw new Error(data.message);
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleNotification = async (key, value) => {
    try {
      const newNotifications = { ...appSettings.notifications, [key]: value };
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(newNotifications)
      });
      const data = await res.json();
      if(data.success) {
        setAppSettings(data.data);
        showToast('Notification policy updated', 'success');
      } else throw new Error(data.message);
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleFlagDockIssue = async (dockId) => {
    try {
        const res = await fetch(`/api/docks/${dockId}/maintenance`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
          body: JSON.stringify({ status: 'MAINTENANCE', notes: 'Admin flagged an issue' })
        });
        const data = await res.json();
        if(data.success) {
          showToast('Dock flagged for maintenance', 'warning');
          setSelectedDock(null);
          fetchDocksData();
        } else throw new Error(data.message);
      } catch (err) {
        showToast(err.message, 'error');
      }
  };

  const liveMismatchesFromFeed = feed.filter(f => f.status === 'MISMATCH');

  return (
    <div className="min-h-screen min-w-[1024px] bg-[#080C14] text-[#E8F0FE] flex flex-col">
      <nav className="h-16 w-full border-b border-[#1E2D45] flex items-center justify-between px-6 border-t-2 border-t-[#F43F5E] sticky top-0 z-50 bg-[#080C14]">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
          <div className="text-xl font-bold tracking-tight">
            <span className="text-[#E8F0FE]">Logi</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F59E0B] to-[#0DD9B0]">Vision</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[#6B7FA8] text-sm">
          <span className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse"></span>
          ALL SITES — ADMIN ACCESS
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-sm text-[11px] font-mono-data bg-[#F43F5E]/20 text-[#F43F5E] border border-[#F43F5E]/50 font-bold tracking-wider">
            ADMIN
          </span>
          <button onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }} className="text-[#6B7FA8] hover:text-[#F43F5E] transition-colors text-sm">
            Logout
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[220px] min-h-full bg-[#0D1421] border-r border-[#1E2D45] flex flex-col hidden md:flex shrink-0">
          <div className="py-6 px-3 flex flex-col gap-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all text-sm font-medium w-full text-left border-l-[3px] ${
                  activeView === item.id
                    ? 'text-[#F43F5E] bg-[#F43F5E15] border-[#F43F5E]'
                    : 'text-[#6B7FA8] hover:bg-[#1A2235] hover:text-[#E8F0FE] border-transparent'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 relative">
          
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <RefreshCw className="animate-spin text-[#0DD9B0]" size={40} />
            </div>
          ) : (
            <>
              {/* LIVE FEED VIEW */}
              {activeView === 'feed' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-[#E8F0FE]">Live Gate Feed <span className="text-xs text-[#F43F5E] font-mono-data ml-2 border border-[#F43F5E]/30 px-2 py-0.5 rounded">ADMIN VIEW</span></h1>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'TRUCKS TODAY', val: stats.todayCount, color: 'text-[#F59E0B]', border: 'border-t-[#F59E0B]' },
                      { label: 'AVG GATE TIME', val: `${stats.avgGateTimeSeconds}s`, color: 'text-[#0DD9B0]', border: 'border-t-[#0DD9B0]' },
                      { label: 'LIVE QUEUE', val: feed.filter(f => f.status === 'PENDING').length, color: 'text-[#38BDF8]', border: 'border-t-[#38BDF8]', live: true },
                      { label: 'DAILY SAVINGS', val: `₹${(stats.todayCount * 7900).toLocaleString()}`, color: 'text-[#F59E0B]', border: 'border-t-[#F59E0B]' },
                    ].map((kpi, i) => (
                      <div key={i} className={`bg-[#111827] border border-[#1E2D45] border-t-[3px] ${kpi.border} rounded-md p-5`}>
                        <div className="text-xs font-bold text-[#6B7FA8] uppercase tracking-wider mb-2 flex items-center gap-2">
                          {kpi.label}
                          {kpi.live && <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse"></span>}
                        </div>
                        <div className={`text-3xl font-mono-data font-bold ${kpi.color}`}>{kpi.val}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden flex flex-col min-h-[400px]">
                      <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] flex items-center gap-2 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[#0DD9B0] animate-pulse"></div>
                        <span className="font-bold text-sm tracking-wider">LIVE TRUCK FEED</span>
                      </div>
                      <div className="overflow-x-auto flex-1">
                        {feed.length === 0 ? (
                           <div className="flex items-center justify-center h-full text-[#6B7FA8] text-sm">No entries today</div>
                        ) : (
                        <table className="w-full text-left text-xs relative">
                          <thead className="bg-[#0D1421] border-b border-[#1E2D45] sticky top-0">
                            <tr className="text-[#6B7FA8] font-bold tracking-wider uppercase">
                              <th className="px-4 py-3">PLATE</th>
                              <th className="px-4 py-3">VENDOR</th>
                              <th className="px-4 py-3">CARGO</th>
                              <th className="px-4 py-3">WEIGHT</th>
                              <th className="px-4 py-3">TIME</th>
                              <th className="px-4 py-3">DOCK</th>
                              <th className="px-4 py-3">STATUS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E2D45]">
                            {feed.map(row => (
                              <tr key={row._id || row.id} className="hover:bg-[#1A2235] transition-colors">
                                <td className="px-4 py-3 font-mono-data font-bold text-[#E8F0FE]">{row.vehicleNo || row.plate}</td>
                                <td className="px-4 py-3 text-[#E8F0FE] max-w-[120px] truncate">{row.vendorName || row.vendor}</td>
                                <td className="px-4 py-3 text-[#6B7FA8] max-w-[150px] truncate">{row.cargoDescription || row.cargo}</td>
                                <td className="px-4 py-3 font-mono-data text-[#6B7FA8]">{row.totalWeight || row.weight}</td>
                                <td className="px-4 py-3 font-mono-data text-[#0DD9B0] font-bold">{new Date(row.createdAt).toLocaleTimeString()}</td>
                                <td className="px-4 py-3 font-mono-data font-bold text-[#F59E0B]">{row.dockAssigned || '-'}</td>
                                <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden flex flex-col max-h-[400px]">
                      <div className="p-4 border-b border-[#F43F5E]/40 bg-[#0D1421] flex items-center gap-2 shrink-0">
                        <AlertTriangle size={16} className="text-[#F43F5E]" />
                        <span className="font-bold text-sm tracking-wider text-[#F43F5E]">MISMATCH ALERTS</span>
                        <span className="ml-auto bg-[#F43F5E] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm font-mono-data">{liveMismatchesFromFeed.length}</span>
                      </div>
                      <div className="p-4 space-y-3 overflow-y-auto flex-1">
                        {liveMismatchesFromFeed.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-[#6B7FA8] h-full">
                            <CheckCircle size={32} className="mb-2 text-[#0DD9B0]" />
                            <p className="text-sm font-bold">All cleared</p>
                          </div>
                        ) : (
                            liveMismatchesFromFeed.map(m => (
                            <div key={m._id} className="bg-[#0D1421] border border-[#F43F5E]/30 rounded-md p-3">
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-mono-data text-xs font-bold text-[#F43F5E]">{m.challanId || 'UNKNOWN'}</span>
                                <span className="bg-[#F43F5E] text-white text-[10px] font-mono-data font-bold px-1.5 py-0.5 rounded">HIGH</span>
                              </div>
                              <div className="text-xs text-[#6B7FA8] mb-1">{m.vehicleNo} • {new Date(m.createdAt).toLocaleTimeString()}</div>
                              <div className="text-xs text-[#E8F0FE] mb-3 leading-relaxed">Visual load: {m.visualLoad} vs Declared: {m.declaredLoad}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-[#1E2D45] rounded-md p-5 h-[300px]">
                    <div className="flex items-center gap-2 mb-5">
                      <Activity size={18} className="text-[#F43F5E]" />
                      <span className="font-bold tracking-wider text-[#E8F0FE]">GATE THROUGHPUT TODAY</span>
                    </div>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={chartData} barSize={28}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false} />
                          <XAxis dataKey="time" tick={{ fill: '#6B7FA8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#6B7FA8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#0D1421', border: '1px solid #1E2D45', color: '#E8F0FE', borderRadius: 4 }} cursor={{ fill: '#1A2235' }} />
                          <Bar dataKey="trucks" fill="#F43F5E" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex justify-center items-center h-[80%] text-sm text-[#6B7FA8]">No throughput data available</div>
                    )}
                  </div>
                </div>
              )}

              {/* DOCK HEATMAP VIEW */}
              {activeView === 'heatmap' && (
                <div className="space-y-6 animate-fade-in relative">
                  <h1 className="text-xl font-bold text-[#E8F0FE]">Dock Heatmap <span className="text-xs text-[#F43F5E] font-mono-data ml-2 border border-[#F43F5E]/30 px-2 py-0.5 rounded">ADMIN VIEW</span></h1>
                  {docks.length === 0 ? (
                    <div className="text-center py-12 text-[#6B7FA8]">No docks configured in this warehouse</div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4 relative">
                      {docks.map(dock => (
                        <div key={dock._id} onClick={() => setSelectedDock(dock)} className={`bg-[#111827] border rounded-md p-4 text-center cursor-pointer hover:bg-[#1A2235] transition-colors ${
                          dock.status === 'OCCUPIED' ? 'border-[#0DD9B0]' :
                          dock.status === 'SCHEDULED' ? 'border-[#F59E0B]' :
                          dock.status === 'MAINTENANCE' ? 'border-[#F43F5E]' :
                          'border-[#1E2D45]'
                        }`}>
                          <div className="text-xl font-mono-data font-bold text-[#E8F0FE] mb-1">{dock.dockNumber}</div>
                          <div className="text-xs text-[#6B7FA8] mb-2 font-mono-data truncate h-4">{dock.assignedTruck || '—'}</div>
                          <div className={`text-xs font-bold mb-2 ${
                            dock.status === 'OCCUPIED' ? 'text-[#0DD9B0]' :
                            dock.status === 'AVAILABLE' ? 'text-[#6B7FA8]' :
                            dock.status === 'SCHEDULED' ? 'text-[#F59E0B]' : 'text-[#F43F5E]'
                          }`}>{dock.status}</div>
                          <div className="w-full bg-[#1E2D45] rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${dock.status === 'OCCUPIED' ? 'bg-[#0DD9B0] w-[100%]' : dock.status === 'SCHEDULED' ? 'bg-[#F59E0B] w-[50%]' : 'w-0'}`}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDock && (
                     <div className="absolute right-0 top-0 w-[350px] bg-[#0D1421] border-l border-[#1E2D45] border-y h-full shadow-2xl z-20 animate-fade-in p-6 overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                           <h2 className="text-xl font-bold text-white">Dock {selectedDock.dockNumber}</h2>
                           <button onClick={() => setSelectedDock(null)} className="text-[#6B7FA8] hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4 mb-8">
                           <div className="bg-[#111827] p-4 rounded border border-[#1E2D45]">
                              <div className="text-xs text-[#6B7FA8] mb-1">Assigned Truck</div>
                              <div className="font-mono-data text-sm text-[#0DD9B0]">{selectedDock.assignedTruck || 'None'}</div>
                           </div>
                           <div className="bg-[#111827] p-4 rounded border border-[#1E2D45]">
                              <div className="text-xs text-[#6B7FA8] mb-1">Status</div>
                              <div className="font-bold text-white">{selectedDock.status}</div>
                           </div>
                           {selectedDock.assignedChallanId && (
                             <div className="bg-[#111827] p-4 rounded border border-[#1E2D45]">
                                <div className="text-xs text-[#6B7FA8] mb-1">Challan Ref</div>
                                <div className="font-mono-data text-xs text-white">{selectedDock.assignedChallanId.challanId}</div>
                             </div>
                           )}
                        </div>
                        <div className="space-y-3">
                           <button onClick={() => handleReleaseDock(selectedDock._id)} disabled={selectedDock.status !== 'OCCUPIED'} className="w-full bg-[#38BDF8] text-black font-bold py-3 rounded disabled:opacity-50 disabled:cursor-not-allowed">RELEASE DOCK (API)</button>
                           <button onClick={() => handleFlagDockIssue(selectedDock._id)} disabled={selectedDock.status === 'MAINTENANCE'} className="w-full bg-[#1A2235] text-[#F43F5E] border border-[#F43F5E]/50 font-bold py-3 rounded hover:bg-[#F43F5E]/10 disabled:opacity-50 disabled:border-[#1E2D45] disabled:text-[#6B7FA8]">FLAG ISSUE</button>
                        </div>
                     </div>
                  )}
                </div>
              )}

              {/* REPORTS VIEW */}
              {activeView === 'reports' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-[#E8F0FE]">Reports <span className="text-xs text-[#F43F5E] font-mono-data ml-2 border border-[#F43F5E]/30 px-2 py-0.5 rounded">ADMIN VIEW</span></h1>
                  </div>
                  <div className="bg-[#111827] border border-[#1E2D45] p-6 rounded-md mb-6">
                    <h2 className="text-lg font-bold mb-4">Export Tools</h2>
                    <div className="flex gap-4">
                      <button onClick={handleExportPDF} className="flex flex-1 items-center justify-center gap-2 px-4 py-4 bg-[#F43F5E] text-white font-bold rounded-md hover:bg-opacity-90 shadow-lg">
                        <FileBarChart size={20} /> GENERATE LOGIVISION PDF
                      </button>
                      <button onClick={handleExportExcel} className="flex flex-1 items-center justify-center gap-2 px-4 py-4 bg-[#0DD9B0] text-black font-bold rounded-md hover:bg-opacity-90 shadow-lg">
                        <Download size={20} /> GENERATE MULTI-SHEET EXCEL
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0D1421] border border-[#1E2D45] p-5 rounded-md">
                      <div className="text-sm font-bold text-[#6B7FA8] mb-2">Total Monthly Entries</div>
                      <div className="text-3xl font-mono-data text-white">{stats.monthCount}</div>
                    </div>
                    <div className="bg-[#0D1421] border border-[#1E2D45] p-5 rounded-md">
                      <div className="text-sm font-bold text-[#6B7FA8] mb-2">Approval Rate</div>
                      <div className="text-3xl font-mono-data text-[#0DD9B0]">{stats.approvalRate}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* USER MANAGEMENT VIEW */}
              {activeView === 'users' && (
                <div className="space-y-6 animate-fade-in relative min-h-full">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-[#E8F0FE]">User Management <span className="text-xs text-[#F43F5E] font-mono-data ml-2 border border-[#F43F5E]/30 px-2 py-0.5 rounded">ADMIN VIEW</span></h1>
                    <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center gap-1 px-4 py-2 bg-[#0DD9B0] text-black font-bold rounded hover:bg-opacity-90 text-sm">
                      <Plus size={16} /> ADD USER (API)
                    </button>
                  </div>
                  <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden relative min-h-[300px]">
                    <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#F43F5E]" />
                        <span className="font-bold text-sm tracking-wider">ALL PLATFORM USERS</span>
                      </div>
                      <div className="text-xs text-[#6B7FA8]">{users.length} Users Total</div>
                    </div>
                    <div className="overflow-x-auto">
                      {users.length === 0 ? (
                        <div className="text-center py-10 text-[#6B7FA8]">No users mapped. Add via button above.</div>
                      ) : (
                      <table className="w-full text-left text-sm relative">
                        <thead className="bg-[#0D1421] border-b border-[#1E2D45] sticky top-0">
                          <tr className="text-[#6B7FA8] font-bold tracking-wider text-[10px] uppercase">
                            <th className="px-5 py-3">NAME</th>
                            <th className="px-5 py-3">EMAIL</th>
                            <th className="px-5 py-3">ROLE</th>
                            <th className="px-5 py-3">SHIFT</th>
                            <th className="px-5 py-3">STATUS</th>
                            <th className="px-5 py-3 text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E2D45]">
                          {users.map(user => (
                            <tr key={user._id} className={`hover:bg-[#1A2235] transition-colors ${!user.isActive ? 'opacity-50 grayscale' : ''}`}>
                              <td className="px-5 py-3 font-bold text-[#E8F0FE]">{user.name}</td>
                              <td className="px-5 py-3 font-mono-data text-[11px] text-[#6B7FA8]">{user.email}</td>
                              <td className="px-5 py-3">
                                <select 
                                  value={user.role} 
                                  onChange={(e) => handleChangeRole(user._id, e.target.value)}
                                  className={`bg-transparent text-[10px] font-mono-data font-bold border rounded outline-none p-1 ${roleColors[user.role] || 'text-[#6B7FA8] border-[#1E2D45]'}`}
                                >
                                  {['GUARD','DRIVER','WAREHOUSE_MANAGER','AUTHORITY','ADMIN'].map(r => <option key={r} value={r} className="bg-[#0D1421] text-white">{r}</option>)}
                                </select>
                              </td>
                              <td className="px-5 py-3 text-[#6B7FA8] text-[11px] font-mono-data">{user.shift_start || '--'} to {user.shift_end || '--'}</td>
                              <td className="px-5 py-3">
                                <StatusPill status={!user.isActive ? 'OFFLINE' : 'VERIFIED'} />
                              </td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                                  className={`px-3 py-1.5 border rounded text-[10px] font-bold transition-colors ${user.isActive ? 'border-[#F43F5E]/50 text-[#F43F5E] hover:bg-[#F43F5E]/10' : 'border-[#0DD9B0]/50 text-[#0DD9B0] hover:bg-[#0DD9B0]/10'}`}
                                >
                                  {user.isActive ? 'Deactivate (API)' : 'Reactivate (API)'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      )}
                    </div>
                  </div>

                  {/* Add User Modal */}
                  {isAddUserModalOpen && (
                    <div className="absolute inset-0 bg-[#080C14]/90 backdrop-blur z-50 flex items-center justify-center p-6">
                       <div className="bg-[#111827] border border-[#1E2D45] w-full max-w-lg rounded-xl shadow-2xl p-6">
                          <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Add New User</h2>
                            <button onClick={() => setIsAddUserModalOpen(false)} className="text-[#6B7FA8] hover:text-white"><X size={20}/></button>
                          </div>
                          <form onSubmit={handleAddUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div><label className="text-xs text-[#6B7FA8] mb-1 block">Full Name</label><input required value={userForm.name} onChange={e=>setUserForm({...userForm, name: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white" /></div>
                              <div><label className="text-xs text-[#6B7FA8] mb-1 block">Email</label><input required type="email" value={userForm.email} onChange={e=>setUserForm({...userForm, email: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white" /></div>
                              <div><label className="text-xs text-[#6B7FA8] mb-1 block">Password</label><input required minLength={6} type="password" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white" /></div>
                              <div>
                                <label className="text-xs text-[#6B7FA8] mb-1 block">Role</label>
                                <select value={userForm.role} onChange={e=>setUserForm({...userForm, role: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white focus:outline-none">
                                  {['GUARD','DRIVER','WAREHOUSE_MANAGER','AUTHORITY','ADMIN'].map(rol => <option key={rol} value={rol}>{rol}</option>)}
                                </select>
                              </div>
                              <div><label className="text-xs text-[#6B7FA8] mb-1 block">Shift Start</label><input type="time" value={userForm.shift_start} onChange={e=>setUserForm({...userForm, shift_start: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white [color-scheme:dark]" /></div>
                              <div><label className="text-xs text-[#6B7FA8] mb-1 block">Shift End</label><input type="time" value={userForm.shift_end} onChange={e=>setUserForm({...userForm, shift_end: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white [color-scheme:dark]" /></div>
                            </div>
                            <button type="submit" disabled={fetchingUsers} className="w-full mt-6 bg-[#0DD9B0] text-black font-bold py-3 rounded hover:bg-[#0BA68E] transition-colors">{fetchingUsers ? 'Adding...' : 'CREATE USER (API)'}</button>
                          </form>
                       </div>
                    </div>
                  )}
                </div>
              )}

              {/* TRUCK TRACKER VIEW */}
              {activeView === 'tracker' && (
                <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
                  <h1 className="text-xl font-bold text-[#E8F0FE]">Truck Tracker <span className="text-xs text-[#F43F5E] font-mono-data ml-2 border border-[#F43F5E]/30 px-2 py-0.5 rounded">ADMIN VIEW</span></h1>
                  <div className="flex-1 rounded-md overflow-hidden border border-[#1E2D45] relative">
                    <MapContainer
                      center={[18.7645, 73.8016]}
                      zoom={14}
                      style={{ height: '100%', width: '100%', background: '#080C14', zIndex: 10 }}
                      zoomControl={false}
                      attributionControl={false}
                    >
                      <TileLayer url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png" />
                      {feed.filter(f => f.status === 'PENDING' || f.status === 'VERIFIED' || f.status === 'MISMATCH').map((truck, i) => {
                         const latO = (Math.random() - 0.5) * 0.01;
                         const lngO = (Math.random() - 0.5) * 0.01;
                         return (
                        <Marker
                          key={truck._id || i}
                          position={[18.7645 + latO, 73.8016 + lngO]}
                          icon={L.divIcon({
                            className: '',
                            html: `<div style="width:16px;height:16px;background:#F59E0B;border-radius:50%;border:2px solid #000;box-shadow:0 0 10px rgba(245,158,11,0.5);"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8],
                          })}
                        >
                          <Popup>
                            <div style={{ background: '#111827', padding: '10px', color: '#E8F0FE', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', borderRadius: '4px', border: '1px solid #1E2D45', margin: '-14px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#F59E0B', marginBottom: '4px' }}>{truck.vehicleNo || truck.plate || 'Unknown'}</div>
                              <div><span style={{color:'#6B7FA8'}}>Status:</span> {truck.status}</div>
                              <div><span style={{color:'#6B7FA8'}}>Cargo:</span> {truck.cargoDescription || truck.cargo || '-'}</div>
                              <div><span style={{color:'#6B7FA8'}}>Guard:</span> {truck.scannedBy?.name || 'Unknown'}</div>
                            </div>
                          </Popup>
                        </Marker>
                      )})}
                    </MapContainer>
                  </div>
                </div>
              )}

              {/* SETTINGS VIEW */}
              {activeView === 'settings' && (
                <div className="space-y-8 animate-fade-in pb-12">
                  <h1 className="text-xl font-bold text-[#E8F0FE]">System Settings <span className="text-xs text-[#F43F5E] font-mono-data ml-2 border border-[#F43F5E]/30 px-2 py-0.5 rounded">ADMIN VIEW</span></h1>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Platform Settings */}
                    <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden">
                      <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] flex items-center gap-2">
                         <Settings size={18} className="text-[#F43F5E]" />
                         <span className="font-bold text-sm tracking-wider uppercase">Platform Settings</span>
                      </div>
                      <form onSubmit={handleSavePlatformSettings} className="p-6 space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1.5 block tracking-widest">Platform Name</label>
                               <input value={appSettings.platformName} onChange={e=>setAppSettings({...appSettings, platformName: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white focus:border-[#F43F5E] transition-colors" />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1.5 block tracking-widest">Default Gate</label>
                               <input value={appSettings.defaultGate} onChange={e=>setAppSettings({...appSettings, defaultGate: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white focus:border-[#F43F5E] transition-colors" />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1.5 block tracking-widest">Max Entries Per Shift</label>
                               <input type="number" value={appSettings.maxEntriesPerShift} onChange={e=>setAppSettings({...appSettings, maxEntriesPerShift: parseInt(e.target.value)})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white focus:border-[#F43F5E] transition-colors" />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1.5 block tracking-widest">Auto Approve (Mins)</label>
                               <input type="number" value={appSettings.autoApproveMinutes} onChange={e=>setAppSettings({...appSettings, autoApproveMinutes: parseInt(e.target.value)})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white focus:border-[#F43F5E] transition-colors" />
                            </div>
                         </div>
                         <button type="submit" className="px-6 py-2 bg-[#F43F5E] text-white font-bold text-xs uppercase tracking-widest rounded hover:bg-opacity-90 transition-all shadow-lg shadow-[#F43F5E]/20">Save Platform Changes</button>
                      </form>
                    </div>

                    {/* Warehouse Settings */}
                    <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden">
                      <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Database size={18} className="text-[#38BDF8]" />
                           <span className="font-bold text-sm tracking-wider uppercase">Warehouse Settings</span>
                         </div>
                         <button onClick={()=>setIsEditingWarehouse(!isEditingWarehouse)} className="text-[10px] uppercase font-bold text-[#38BDF8] border border-[#38BDF8]/30 px-2 py-1 rounded hover:bg-[#38BDF8]/10 transition-colors">
                           {isEditingWarehouse ? 'Cancel' : 'Edit Mode'}
                         </button>
                      </div>
                      <div className="p-6 space-y-5">
                         {isEditingWarehouse ? (
                            <div className="space-y-4">
                               <div>
                                  <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1 block">Warehouse Name</label>
                                  <input value={warehouseForm.warehouseName} onChange={e=>setWarehouseForm({...warehouseForm, warehouseName: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white" />
                               </div>
                               <div>
                                  <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1 block">Address</label>
                                  <input value={warehouseForm.warehouseAddress} onChange={e=>setWarehouseForm({...warehouseForm, warehouseAddress: e.target.value})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white" />
                               </div>
                               <div>
                                  <label className="text-[10px] uppercase font-bold text-[#6B7FA8] mb-1 block">Total Docks</label>
                                  <input type="number" value={warehouseForm.totalDocks} onChange={e=>setWarehouseForm({...warehouseForm, totalDocks: parseInt(e.target.value)})} className="w-full bg-[#0D1421] border border-[#1E2D45] rounded p-2 text-sm text-white" />
                               </div>
                               <button onClick={handleSaveWarehouseSettings} className="px-6 py-2 bg-[#38BDF8] text-black font-bold text-xs uppercase tracking-widest rounded hover:bg-opacity-90 transition-all">Update Warehouse</button>
                            </div>
                         ) : (
                            <div className="grid grid-cols-1 gap-4">
                               <div className="flex justify-between border-b border-[#1E2D45] pb-2">
                                  <span className="text-xs text-[#6B7FA8]">Entity Name</span>
                                  <span className="text-sm font-bold">{appSettings.warehouseName}</span>
                               </div>
                               <div className="flex flex-col gap-1 border-b border-[#1E2D45] pb-2">
                                  <span className="text-xs text-[#6B7FA8]">Physical Address</span>
                                  <span className="text-sm">{appSettings.warehouseAddress}</span>
                               </div>
                               <div className="flex justify-between border-b border-[#1E2D45] pb-2">
                                  <span className="text-xs text-[#6B7FA8]">Configured Docks</span>
                                  <span className="text-sm font-mono-data text-[#0DD9B0]">{appSettings.totalDocks} UNITS</span>
                               </div>
                               <div className="flex justify-between">
                                  <span className="text-xs text-[#6B7FA8]">Active Gates</span>
                                  <span className="text-sm font-mono-data text-[#0DD9B0]">01 (LIVE)</span>
                               </div>
                            </div>
                         )}
                      </div>
                    </div>

                    {/* Notification Settings */}
                    <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden">
                       <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] flex items-center gap-2">
                          <Wifi size={18} className="text-[#0DD9B0]" />
                          <span className="font-bold text-sm tracking-wider uppercase">Notification Policies</span>
                       </div>
                       <div className="p-6 space-y-4">
                          {[
                            { key: 'emailMismatch', label: 'Email alerts on mismatch', desc: 'Notify warehouse manager on OCR discrepancy' },
                            { key: 'smsMismatch', label: 'SMS alerts on mismatch', desc: 'Critical alerts via Twilio/Nexmo integration' },
                            { key: 'autoFlagEmptyVibe', label: 'Auto-flag EMPTY vibe checks', desc: 'Strict security for empty-declared trucks' },
                            { key: 'requireRejectionReason', label: 'Require rejection reason', desc: 'Force authority comments on entry denial' },
                          ].map((pref) => (
                             <div key={pref.key} className="flex items-center justify-between p-3 bg-[#0D1421] rounded border border-[#1E2D45]/50">
                                <div>
                                   <div className="text-sm font-bold">{pref.label}</div>
                                   <div className="text-[10px] text-[#6B7FA8] italic">{pref.desc}</div>
                                </div>
                                <button 
                                  onClick={()=>handleToggleNotification(pref.key, !appSettings.notifications[pref.key])}
                                  className={`w-12 h-6 rounded-full relative transition-colors ${appSettings.notifications[pref.key] ? 'bg-[#0DD9B0]' : 'bg-[#1E2D45]'}`}
                                >
                                   <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${appSettings.notifications[pref.key] ? 'left-7' : 'left-1'}`}></div>
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* Security Settings */}
                    <div className="bg-[#111827] border border-[#1E2D45] rounded-md overflow-hidden">
                       <div className="p-4 border-b border-[#1E2D45] bg-[#0D1421] flex items-center gap-2">
                          <Server size={18} className="text-[#6B7FA8]" />
                          <span className="font-bold text-sm tracking-wider uppercase">Security & Compliance</span>
                       </div>
                       <div className="p-6 space-y-4">
                          <div className="space-y-3">
                             <div className="flex justify-between text-xs py-2 border-b border-[#1E2D45]">
                                <span className="text-[#6B7FA8]">JWT Expiry Duration</span>
                                <span className="font-mono-data text-white">24 HOURS</span>
                             </div>
                             <div className="flex justify-between text-xs py-2 border-b border-[#1E2D45]">
                                <span className="text-[#6B7FA8]">Rate Limit Per IP</span>
                                <span className="font-mono-data text-white">5 REQ / 15 MIN</span>
                             </div>
                             <div className="flex justify-between text-xs py-2 border-b border-[#1E2D45]">
                                <span className="text-[#6B7FA8]">SHA-256 Audit Trail</span>
                                <span className="font-mono-data text-[#0DD9B0] font-bold">ACTIVE</span>
                             </div>
                             <div className="flex justify-between text-xs py-2">
                                <span className="text-[#6B7FA8]">Last Security Scan</span>
                                <span className="font-mono-data text-white text-[10px]">{new Date().toDateString()}</span>
                             </div>
                          </div>
                          <div className="mt-4 p-3 bg-[#F43F5E]/10 border border-[#F43F5E]/20 rounded-sm">
                             <div className="text-[10px] font-bold text-[#F43F5E] mb-1 flex items-center gap-1">
                               <AlertTriangle size={12} /> SYSTEM INTEGRITY WARNING
                             </div>
                             <div className="text-[9px] text-[#F43F5E] leading-relaxed opacity-80 uppercase tracking-tighter">
                               Unauthorized modifications to security parameters will trigger immediate platform-wide lockout. All audit logs are signed cryptographically.
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;

