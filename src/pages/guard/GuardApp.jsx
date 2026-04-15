import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MobileBottomTabs from '../../components/layout/MobileBottomTabs';
import { Scan, History, AlertTriangle, UserCircle, Camera, CheckSquare, XSquare, FileText, ArrowLeft, LogOut, Volume2, Vibrate, RefreshCw, CheckCircle2, Truck, Shield, Clock, BarChart3, Info, AlertOctagon } from 'lucide-react';
import { useSocket } from '../../services/SocketProvider';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import StatusPill from '../../components/ui/StatusPill';

/* ========================================
   UTILITIES
   ======================================== */
const getToken = () => {
  const t1 = localStorage.getItem('logivision_token');
  if (t1 && t1 !== 'null' && t1 !== 'undefined') return t1;
  const t2 = sessionStorage.getItem('logivision_token');
  if (t2 && t2 !== 'null' && t2 !== 'undefined') return t2;
  return '';
};

/* ========================================
   SCAN TAB — Complete 2026 Industrial Flow
   ======================================== */
const ScanTab = () => {
  const { emit, feed = [] } = useSocket();
  const { addToast: showToast } = useToast();
  const { t } = useLanguage();

  // Flow states
  const [plateDone, setPlateDone] = useState(false);
  const [challanDone, setChallanDone] = useState(false);
  const [loadCheck, setLoadCheck] = useState(null);
  const [scanAnim, setScanAnim] = useState('IDLE');
  const [scanTarget, setScanTarget] = useState(null);
  const [flowScreen, setFlowScreen] = useState('MAIN');
  const [isOffline, setIsOffline] = useState(false);
  const [extractedChallanData, setExtractedChallanData] = useState(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [scanMethod, setScanMethod] = useState('ocr');
  const [manualData, setManualData] = useState({ challanId: '', vehicleNo: '', from: '', to: '', items: '', weight: '', value: '', capacity: '' });

  // File upload states
  const [plateImage, setPlateImage] = useState(null);
  const [challanImage, setChallanImage] = useState(null);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [isEscalated, setIsEscalated] = useState(false);
  const plateInputRef = React.useRef(null);
  const challanInputRef = React.useRef(null);
  const galleryChallanInputRef = React.useRef(null);
  const loadInputRef = React.useRef(null);
  const [loadPhoto, setLoadPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChallanPreview, setShowChallanPreview] = useState(false);

  // Parsed data
  const [plateData, setPlateData] = useState({ plate: '', details: '' });

  // Device Preference Helpers
  const triggerVibrate = () => {
    if (localStorage.getItem('app_pref_vibrate') === 'true' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const playBeep = () => {
    if (localStorage.getItem('app_pref_sound') === 'true') {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 800; // Hz
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 150);
      } catch(e) {}
    }
  };

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      if (localStorage.getItem('app_pref_awake') === 'true' && 'wakeLock' in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {}
      }
    };
    requestWakeLock();
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  const resetFlow = () => {
    setPlateDone(false);
    setChallanDone(false);
    setLoadCheck(null);
    setScanAnim('IDLE');
    setScanTarget(null);
    setFlowScreen('MAIN');
    setPlateImage(null);
    setChallanImage(null);
    setPlateData({ plate: '', details: '' });
    setExtractedChallanData(null);
    setIsManualMode(false);
    setScanMethod('ocr');
    setManualData({ challanId: '', vehicleNo: '', from: '', to: '', items: '', weight: '', value: '', capacity: '' });
    setLoadPhoto(null);
  };

  const handleScanPlate = () => plateInputRef.current?.click();
  const handleScanChallan = () => {
    setShowChallanPreview(false);
    challanInputRef.current?.click();
  };
  const handleGalleryChallan = () => {
    setShowChallanPreview(false);
    galleryChallanInputRef.current?.click();
  };
  const handleScanLoad = () => loadInputRef.current?.click();

  const handlePlateFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target.result;
        setPlateImage(imageData);
        setScanTarget('PLATE');
        setScanAnim('SCANNING');

        try {
          setScanAnim('PARSING');
          const response = await fetch('/api/challans/ocr-plate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ imageUrl: imageData })
          });

          const result = await response.json();
          if (result.success) {
            setPlateData({
              plate: result.data.vehicleNo,
              details: result.data.vehicleNo === 'ERROR' ? result.data.details : ''
            });
            setScanAnim('DONE');
            setPlateDone(true);
            triggerVibrate();
          } else {
            throw new Error(result.message || 'Plate OCR failed');
          }
        } catch (error) {
          showToast('OCR Engine Error — Manual check required', 'error');
          setScanAnim('IDLE');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChallanFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setChallanImage(e.target.result);
        setScanTarget('CHALLAN');
        setShowChallanPreview(true);
        setScanAnim('IDLE');
      };
      reader.readAsDataURL(file);
    }
  };

  const processChallanOCR = async () => {
    if (!challanImage) return;
    setShowChallanPreview(false);
    setScanAnim('SCANNING');

    try {
      setScanAnim('PARSING');
      const response = await fetch('/api/challans/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ imageUrl: challanImage })
      });

      const result = await response.json();
      if (result.success) {
        setExtractedChallanData(result.data);
        showToast('✓ AI Extraction complete', 'success');
        setScanAnim('DONE');
        setChallanDone(true);
        triggerVibrate();
      } else {
        throw new Error(result.message || 'OCR failed');
      }
    } catch (error) {
      showToast('AI Scan failed — Manual entry required', 'error');
      setScanAnim('IDLE');
    }
  };

  const handleLoadPhotoSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setLoadPhoto(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleManualMode = () => {
    if (!isManualMode && extractedChallanData) {
      setManualData({
        challanId: extractedChallanData.challanId || '',
        vehicleNo: extractedChallanData.vehicleNo || plateData.plate || '',
        from: extractedChallanData.vendorName || '',
        to: extractedChallanData.destination || '',
        items: extractedChallanData.cargoDescription || '',
        weight: extractedChallanData.totalWeight || '',
        value: '', 
        capacity: extractedChallanData.declaredLoad || ''
      });
    }
    setIsManualMode(!isManualMode);
    setScanMethod(!isManualMode ? 'manual' : 'ocr');
  };

  const handleSubmitEntry = async () => {
    setIsLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const normalize = (val) => val ? val.toString().replace(/[^A-Z0-9]/ig, '').toUpperCase() : '';
      const plate = normalize(plateData.plate);
      const challan = normalize(extractedChallanData?.vehicleNo || manualData.vehicleNo);
      
      const isPlateMatch = isManualMode || (plate === challan);
      const declared = isManualMode ? manualData.capacity : (extractedChallanData?.declaredLoad || 'EMPTY');
      const isLoadMatch = loadCheck === declared;

      if (!isPlateMatch && !isEscalated) {
        setMismatchCount(prev => prev + 1);
        showToast('Vehicle Mismatch — Check plate & challan again', 'error');
        setIsLoading(false);
        return;
      }

      const entryData = isManualMode ? {
        challanId: manualData.challanId || 'MANUAL',
        vehicleNo: manualData.vehicleNo,
        vendorName: manualData.from,
        destination: manualData.to,
        cargoDescription: manualData.items,
        totalWeight: parseFloat(manualData.weight) || 0,
        declaredLoad: manualData.capacity,
        visualLoad: loadCheck,
        status: 'PENDING',
        scan_method: 'manual',
        imageUrl: loadPhoto
      } : {
        challanId: extractedChallanData?.challanId,
        vehicleNo: plateData.plate,
        vendorName: extractedChallanData?.vendorName,
        destination: extractedChallanData?.destination,
        cargoDescription: extractedChallanData?.cargoDescription || extractedChallanData?.itemsList?.map(it => `${it.name} x${it.qty}`).join(', '),
        totalWeight: parseFloat(extractedChallanData?.totalWeight) || 0,
        declaredLoad: declared,
        visualLoad: loadCheck,
        status: isLoadMatch ? 'VERIFIED' : 'PENDING',
        scan_method: 'ocr',
        imageUrl: loadPhoto
      };

      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entryData)
      });

      const data = await res.json();
      if (data.success) {
        showToast(isLoadMatch ? 'Entry Verified & Logged' : 'Mismatch Logged — Manager Notified', 'success');
        setFlowScreen(isLoadMatch ? 'VERIFIED' : 'MISMATCH');
        playBeep();
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlag = () => {
    emit('mismatch:flagged', {
      plate: plateData.plate,
      timestamp: new Date().toISOString(),
      status: 'FLAGGED'
    });
    showToast('Mismatch flagged — Manager notified', 'warning');
    resetFlow();
  };

  /* ---- RENDER FLOW SCREENS ---- */
  if (flowScreen === 'VERIFIED') {
    return (
      <div className="absolute inset-0 bg-[#080C14] z-50 flex flex-col items-center justify-center p-6 pb-24 h-screen">
        <div className="bg-[#0D1421] border border-[#0DD9B0] w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl shadow-[#0DD9B0]/10">
          <div className="w-20 h-20 mx-auto bg-[#0DD9B0]/10 rounded-full flex items-center justify-center mb-6">
            <CheckSquare size={40} className="text-[#0DD9B0]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0DD9B0] mb-2 tracking-tight">ENTRY CLEARED</h2>
          <div className="bg-[#080C14] rounded-2xl border border-[#1E2D45] p-5 text-left space-y-4 mb-8 mt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B7FA8] font-black uppercase tracking-wider">Vehicle</span>
              <span className="text-white font-mono font-bold tracking-tight">{plateData.plate}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B7FA8] font-black uppercase tracking-wider">Dock Assigned</span>
              <span className="text-[#F59E0B] font-mono font-bold">DOCK-07</span>
            </div>
          </div>
          <button onClick={resetFlow} className="w-full bg-gradient-to-r from-[#0DD9B0] to-[#0BA68E] text-black font-black py-4 rounded-2xl shadow-lg shadow-[#0DD9B0]/20 active:scale-95 transition-transform">SCAN NEXT TRUCK</button>
        </div>
      </div>
    );
  }

  if (flowScreen === 'MISMATCH') {
    return (
      <div className="absolute inset-0 bg-[#080C14] z-50 flex flex-col items-center justify-center p-6 pb-24 h-screen">
        <div className="bg-[#0D1421] border border-[#F43F5E] w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl shadow-[#F43F5E]/10">
          <div className="w-20 h-20 mx-auto bg-[#F43F5E]/10 rounded-full flex items-center justify-center mb-6">
            <AlertOctagon size={40} className="text-[#F43F5E]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-8 bg-[#F43F5E] py-2 rounded-xl">MISMATCH LOGGED</h2>
          <div className="w-full bg-[#080C14] border border-[#1E2D45] p-6 rounded-2xl mb-8 space-y-4 text-left">
             <div className="flex justify-between text-xs font-black">
                <span className="text-[#6B7FA8] uppercase tracking-wider">TRUCK NO:</span>
                <span className="text-white font-mono">{plateData.plate}</span>
             </div>
             <div className="flex justify-between text-xs font-black">
                <span className="text-[#6B7FA8] uppercase tracking-wider">VISUAL CHECK:</span>
                <span className="text-[#F43F5E] font-mono">{loadCheck}</span>
             </div>
          </div>
          <div className="space-y-3">
             <button onClick={handleFlag} className="w-full bg-[#F43F5E] text-white font-black py-4 rounded-xl shadow-lg shadow-[#F43F5E]/20">NOTIFY MANAGER</button>
             <button onClick={resetFlow} className="w-full border border-[#1E2D45] text-[#6B7FA8] font-black py-4 rounded-xl">RE-SCAN</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#080C14]">
      {/* 2026 Status Bar */}
      <div className="sticky top-0 z-[100] glass-header px-5 py-4 border-b border-[#1E2D45] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center">
            <Shield size={18} className="text-[#F59E0B]" />
          </div>
          <div>
            <div className="text-[10px] font-black text-[#6B7FA8] uppercase tracking-[0.1em] mb-0.5">Gate 03 · Panvel</div>
            <div className="text-xs font-mono text-white font-bold tracking-tight">SEC_SYS_ONLINE</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-wider mb-0.5">SHIFT PROGRESS</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#0DD9B0] font-black">{feed.length} Scans</span>
            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-[#F43F5E]' : 'bg-[#0DD9B0]'} animate-pulse shadow-[0_0_8px] shadow-current`}></div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6 pt-6">
        <div className="px-5 space-y-8">
          
          {/* Main Viewfinder */}
          <div className="relative">
            <div className="bg-industrial-gradient border border-[#1E2D45] rounded-[28px] overflow-hidden shadow-2xl relative p-2 shadow-amber-glow">
              <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-black flex items-center justify-center border border-[#FFFFFF08]">
                
                {/* Visual Corner Brackets */}
                <div className="corner-bracket bracket-tl"></div>
                <div className="corner-bracket bracket-tr"></div>
                <div className="corner-bracket bracket-bl"></div>
                <div className="corner-bracket bracket-br"></div>

                <input ref={plateInputRef} type="file" accept="image/*" capture="environment" onChange={handlePlateFileSelect} className="hidden" />
                <input ref={challanInputRef} type="file" accept="image/*" capture="environment" onChange={handleChallanFileSelect} className="hidden" />
                <input ref={galleryChallanInputRef} type="file" accept="image/*" onChange={handleChallanFileSelect} className="hidden" />
                <input ref={loadInputRef} type="file" accept="image/*" capture="environment" onChange={handleLoadPhotoSelect} className="hidden" />

                <div className="w-full h-full relative">
                  {plateImage && scanTarget === 'PLATE' ? (
                    <img src={plateImage} className="w-full h-full object-cover" alt="Plate" />
                  ) : challanImage && scanTarget === 'CHALLAN' ? (
                    <img src={challanImage} className="w-full h-full object-cover opacity-60 backdrop-sepia-[0.2]" alt="Challan" />
                  ) : loadPhoto ? (
                    <img src={loadPhoto} className="w-full h-full object-cover" alt="Load Evidence" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-[#1A2235]/50 border border-[#1E2D45] flex items-center justify-center text-[#3D4F6B]">
                        <Camera size={32} />
                      </div>
                      <div className="text-[10px] text-[#6B7FA8] font-black uppercase tracking-[0.2em]">Ready for sensor input</div>
                    </div>
                  )}

                  {/* Laser Scan Animation */}
                  {scanAnim === 'PARSING' && (
                    <div className="absolute left-0 right-0 h-[2px] bg-[#F59E0B] shadow-[0_0_15px_#F59E0B] z-50 animate-scan"></div>
                  )}

                  {/* Processing HUD */}
                  {scanAnim === 'PARSING' && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[60]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-[#F59E0B] text-[10px] font-black tracking-widest uppercase animate-pulse font-mono">NEURAL_OCR_ACTIVE</div>
                      </div>
                    </div>
                  )}

                  {/* Plate Scan Switcher */}
                  <button 
                    onClick={handleScanPlate}
                    className={`absolute top-4 right-4 p-2.5 rounded-xl border-2 backdrop-blur-xl transition-all z-[80] ${
                      plateDone ? 'bg-[#0DD9B0]/20 border-[#0DD9B0] text-[#0DD9B0]' : 'bg-black/60 border-white/10 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                       <Camera size={14} className={plateDone ? 'animate-pulse' : ''} />
                       <span className="text-[10px] font-black tracking-widest uppercase">{plateDone ? 'PLATE LOCKED' : 'PLATE SCAN'}</span>
                    </div>
                  </button>

                  {/* Mismatch Indicators */}
                  {mismatchCount > 0 && (
                    <div className="absolute bottom-4 left-4 flex gap-1.5 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 z-[80]">
                       {[...Array(4)].map((_, i) => (
                         <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < mismatchCount ? 'bg-[#F43F5E] shadow-[0_0_5px_#F43F5E]' : 'bg-white/10'}`}></div>
                       ))}
                    </div>
                  )}
                </div>

                {/* Challan Preview Decision Hub */}
                {showChallanPreview && challanImage && (
                  <div className="absolute inset-0 bg-[#080C14]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 z-[120] animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-[#F59E0B]/10 flex items-center justify-center mb-6">
                       <FileText size={32} className="text-[#F59E0B]" />
                    </div>
                    <div className="text-white font-black text-sm uppercase tracking-widest text-center mb-1">Verify Quality</div>
                    <div className="text-[#6B7FA8] text-[10px] uppercase font-bold tracking-wider mb-8 text-center px-4">Ensure optical clarity for neural extraction</div>
                    <div className="flex flex-col gap-3 w-full">
                      <button onClick={processChallanOCR} className="w-full bg-[#F59E0B] text-black font-black py-4 rounded-xl shadow-lg shadow-[#F59E0B]/20 uppercase text-xs tracking-widest">PROCEED TO AI</button>
                      <button onClick={() => { setShowChallanPreview(false); setChallanImage(null); }} className="w-full border border-[#1E2D45] text-[#6B7FA8] font-black py-3.5 rounded-xl text-[10px] uppercase">Discard & Retake</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Primary Scanner Action */}
          <div className="flex flex-col items-center gap-5">
            {mismatchCount < 4 ? (
              <button 
                onClick={handleScanChallan} 
                disabled={scanAnim === 'PARSING'}
                className="w-[90%] bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-black h-20 rounded-[24px] flex items-center justify-center gap-4 shadow-2xl shadow-amber-900/40 active:scale-95 transition-all transform hover:-translate-y-1"
              >
                <div className="bg-black/10 p-2.5 rounded-xl">
                   <Scan size={28} className="stroke-[2.5]" />
                </div>
                <div className="text-left">
                   <div className="text-[10px] font-black uppercase opacity-60 leading-none mb-1">Optical Scan</div>
                   <div className="text-base font-black tracking-widest uppercase leading-none">Scan Challan</div>
                </div>
              </button>
            ) : (
              <button 
                onClick={handleFlag}
                className="w-[90%] bg-[#F43F5E] text-white h-20 rounded-[24px] flex items-center justify-center gap-4 shadow-2xl shadow-red-900/20 active:scale-95 transition-all"
              >
                <div className="bg-white/10 p-2.5 rounded-xl">
                   <AlertOctagon size={28} className="stroke-[2.5]" />
                </div>
                <div className="text-left">
                   <div className="text-[10px] font-black uppercase opacity-60 leading-none mb-1">SCANNER LOCKED</div>
                   <div className="text-base font-black tracking-widest uppercase leading-none">MANAGER OVERRIDE</div>
                </div>
              </button>
            )}
            
            <div className="flex items-center gap-6">
              <button onClick={handleGalleryChallan} className="text-[10px] text-[#6B7FA8] font-bold uppercase tracking-widest border-b border-[#1E2D45] pb-0.5">GALLERY UPLOAD</button>
              <button onClick={toggleManualMode} className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border transition-all ${isManualMode ? 'bg-[#0DD9B0]/20 border-[#0DD9B0] text-[#0DD9B0]' : 'bg-[#1E2D45] border-[#1E2D45] text-[#6B7FA8]'}`}>
                {isManualMode ? 'MANUAL ACTIVE' : 'MANUAL ENTRY'}
              </button>
            </div>
          </div>

          {/* Vibe Check Panel */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                   <div className="w-1 h-3 bg-[#F59E0B] rounded-full"></div>
                   <div className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Visual Vibe Check</div>
                </div>
                <span className="text-[9px] text-[#F43F5E] font-black uppercase tracking-widest">Mandatory Sensor</span>
             </div>

             <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'FULL', label: 'FULL', icon: Truck, activeClass: 'border-[#0DD9B0] bg-[#0DD9B0]/10 text-white' },
                  { id: 'HALF', label: 'HALF', icon: Truck, activeClass: 'border-[#F59E0B] bg-[#F59E0B]/10 text-white' },
                  { id: 'EMPTY', label: 'EMPTY', icon: Truck, activeClass: 'border-white bg-white/10 text-white' },
                ].map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setLoadCheck(opt.id)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${loadCheck === opt.id ? opt.activeClass + ' scale-105 z-10 shadow-xl' : 'border-[#1E2D45] bg-[#0D1421] text-[#3D4F6B]'}`}
                  >
                     <opt.icon size={28} className={loadCheck === opt.id ? 'opacity-100' : 'opacity-40'} />
                     <span className="text-[11px] font-black tracking-widest">{opt.label}</span>
                  </button>
                ))}
             </div>

             {loadPhoto && (
               <div className="bg-[#111827] border border-[#1E2D45] p-3 rounded-2xl flex items-center justify-between animate-fade-in group">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#1E2D45]">
                        <img src={loadPhoto} className="w-full h-full object-cover" alt="Evidence" />
                     </div>
                     <div>
                        <div className="text-[10px] text-[#0DD9B0] font-black uppercase tracking-wider mb-0.5">SENSORY DATA LOGGED ✓</div>
                        <div className="text-[9px] text-[#6B7FA8] font-bold uppercase">Visual proof anchored to block</div>
                     </div>
                  </div>
                  <button onClick={() => setLoadPhoto(null)} className="p-2 text-[#3D4F6B] hover:text-[#F43F5E] transition-colors"><XSquare size={20}/></button>
               </div>
             )}

             <button onClick={handleScanLoad} className={`w-full h-14 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-all ${loadPhoto ? 'border-[#0DD9B0] bg-[#0DD9B0]/5 text-[#0DD9B0]' : 'border-[#1E2D45] text-[#6B7FA8] hover:border-[#F59E0B]/30'}`}>
                <Camera size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">{loadPhoto ? 'CHANGE HUD PHOTO' : t('SCAN_LOAD') || 'CAPTURE VISUAL HUD'}</span>
             </button>
          </div>

          {/* Manual Form Area */}
          {isManualMode && (
             <div className="bg-[#111827] rounded-[28px] p-6 border border-[#1E2D45] space-y-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between border-b border-[#1E2D45] pb-4">
                   <h3 className="text-white font-black text-xs tracking-widest uppercase">{t('MANUAL_ENTRY')}</h3>
                   <div className="bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] px-2 py-0.5 rounded-full font-black border border-[#F59E0B]/20 uppercase">Overwrite Mode</div>
                </div>
                <div className="space-y-4">
                   {[
                     { label: t('VEHICLE_NO'), key: 'vehicleNo', placeholder: 'MH XX 0000' },
                     { label: 'Consignment Entity', key: 'from', placeholder: 'Vendor / Transporter' },
                     { label: 'Logistics Dock', key: 'to', placeholder: 'D-07, B-12' },
                     { label: 'Declared Mass', key: 'weight', placeholder: 'Mass in KG' },
                   ].map(f => (
                     <div key={f.key}>
                        <label className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-[0.2em] mb-1.5 block ml-1">{f.label}</label>
                        <input 
                          type="text" 
                          placeholder={f.placeholder}
                          value={manualData[f.key]}
                          onChange={(e) => setManualData({...manualData, [f.key]: e.target.value})}
                          className="w-full bg-[#080C14] border border-[#1E2D45] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#F59E0B] transition-all placeholder:opacity-20"
                        />
                     </div>
                   ))}
                 </div>
              </div>
           )}
           
           {/* Scrollable Bottom Action Bar */}
           <div className="mt-8 mb-8 pb-10">
             <button 
               onClick={handleSubmitEntry}
               disabled={!loadCheck || !loadPhoto || isLoading}
               className={`w-full h-14 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all ${
                 (!loadCheck || !loadPhoto || isLoading) 
                 ? 'bg-[#1A2235] text-[#3D4F6B] border border-[#1E2D45] cursor-not-allowed shadow-none' 
                 : 'bg-[#0DD9B0] text-black shadow-[#0DD9B0]/20'
               }`}
             >
               {isLoading ? (
                 <RefreshCw className="animate-spin" size={20} />
               ) : (
                 t('SUBMIT_ENTRY')
               )}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================
   HISTORY TAB
   ======================================== */
const HistoryTab = () => {
  const { feed = [] } = useSocket();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('ALL');
  const displayedFeed = feed.filter(f => activeTab === 'ALL' || (activeTab === 'MISMATCH' && f.status === 'MISMATCH') || activeTab === 'TODAY');

  return (
    <div className="flex flex-col h-full bg-[#080C14]">
      <div className="px-6 pt-10 pb-6 shrink-0">
        <h2 className="text-2xl font-black text-white tracking-widest uppercase">{t('HISTORY')}</h2>
        <div className="flex gap-2 mt-6 overflow-x-auto hide-scrollbar">
          {['ALL', 'TODAY', 'MISMATCH'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all tracking-widest uppercase ${tab === activeTab ? 'bg-[#F59E0B] text-black shadow-lg shadow-[#F59E0B]/20' : 'bg-[#1A2235] text-[#6B7FA8] border border-[#1E2D45]'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-24">
        {displayedFeed.length === 0 ? <div className="text-center text-[#6B7FA8] text-xs py-12 uppercase tracking-widest font-bold">No Records Found</div> : displayedFeed.map(item => (
          <div key={item.id} className="bg-[#1A2235] border border-[#1E2D45] p-4 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <div className="font-mono text-white font-black text-base">{item.plate || '—'}</div>
              <div className="text-[10px] text-[#6B7FA8] font-black uppercase mt-1">{item.vendor || 'Unknown Source'}</div>
            </div>
            <div className="text-right">
              <StatusPill status={item.status || 'PENDING'} />
              <div className="text-[9px] text-[#6B7FA8] font-mono mt-1 uppercase">{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ========================================
   ALERTS TAB
   ======================================== */
const AlertsTab = () => {
  const { addToast: showToast } = useToast();
  const { t } = useLanguage();
  const { mismatches = [] } = useSocket();
  const [expandedCards, setExpandedCards] = useState(new Set());

  const toggleCardExpansion = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#080C14]">
      <div className="px-6 pt-10 pb-6 shrink-0">
        <div className="flex justify-between items-center">
           <h2 className="text-2xl font-black text-white tracking-widest uppercase">{t('ALERTS')}</h2>
           {mismatches.length > 0 && <span className="bg-[#F43F5E] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{mismatches.length} Active</span>}
        </div>
        <p className="text-[#F43F5E] text-[10px] mt-2 font-black uppercase tracking-widest flex items-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] animate-pulse shadow-[0_0_8px_#F43F5E]"></span>
           Network Escalations Required
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-24">
        {mismatches.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 opacity-40">
            <CheckCircle2 size={40} className="text-[#0DD9B0] mb-4" />
            <div className="text-[10px] font-black text-white uppercase tracking-widest">{t('NO_PENDING_ENTRIES')}</div>
          </div>
        ) : (
          mismatches.map(alert => {
            const isEx = expandedCards.has(alert.id);
            return (
              <div key={alert.id} className="bg-[#1A2235] border border-l-4 border-l-[#F43F5E] border-[#1E2D45] rounded-xl overflow-hidden shadow-xl">
                 <div className="p-5 space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="font-mono text-lg font-black text-[#F59E0B]">{alert.vehicleNo || alert.plate}</span>
                       <span className="text-[9px] text-[#6B7FA8] font-bold uppercase">{alert.timeAgo || 'SEC_RELEVANT'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                       <div><span className="text-[#6B7FA8] uppercase font-black block mb-0.5">Declared</span><span className="text-white font-bold">{alert.declaredLoad}</span></div>
                       <div><span className="text-[#6B7FA8] uppercase font-black block mb-0.5">Visual</span><span className="text-[#F43F5E] font-black">{alert.visualLoad}</span></div>
                    </div>
                    <div className={`p-2 rounded text-[10px] font-black uppercase text-center ${alert.status === 'awaiting' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#F43F5E]/10 text-[#F43F5E]'}`}>
                       {alert.status === 'awaiting' ? 'Awaiting Manager Override' : alert.status}
                    </div>
                    <div className="flex gap-2 pt-2">
                       <button onClick={() => toggleCardExpansion(alert.id)} className="flex-1 border border-[#1E2D45] text-white text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider">{isEx ? 'Hide Details' : 'Full Specs'}</button>
                       <button onClick={() => showToast('Escalated to HQ', 'info')} className="flex-1 bg-[#F43F5E] text-white text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider shadow-lg shadow-[#F43F5E]/20">Escalate</button>
                    </div>
                 </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ========================================
   PROFILE TAB
   ======================================== */
const ProfileTab = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { addToast: showToast } = useToast();

  const [prefs, setPrefs] = useState({
    vibrate: localStorage.getItem('app_pref_vibrate') === 'true',
    sound: localStorage.getItem('app_pref_sound') === 'true',
    awake: localStorage.getItem('app_pref_awake') === 'true'
  });

  const togglePref = (key) => {
    const newState = !prefs[key];
    setPrefs(p => ({...p, [key]: newState}));
    localStorage.setItem(`app_pref_${key}`, newState.toString());
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  const updateLanguage = async (newLang) => {
    try {
      setLanguage(newLang);
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
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

  return (
    <div className="flex flex-col h-full bg-[#080C14]">
      <div className="flex flex-col items-center pt-16 pb-8 bg-industrial-gradient border-b border-[#1E2D45]">
        <div className="w-24 h-24 rounded-[32px] bg-[#0D1421] border-2 border-[#1E2D45] flex items-center justify-center mb-5 p-5 shadow-2xl">
          <img src="/logo.png" alt="Guard" className="w-full h-full object-contain opacity-80" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-widest">{user?.name || 'Vijay Yadav'}</h2>
        <div className="mt-2 px-4 py-1.5 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-black uppercase tracking-widest">{user?.role === 'GUARD' ? 'Master Security Unit' : 'Logistics Intelligence'}</div>
        <div className="mt-4 text-[10px] text-[#6B7FA8] font-black uppercase tracking-widest opacity-60">Gate 03 · Industrial Logistic Hub</div>
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-32 hide-scrollbar">
        <div className="grid grid-cols-2 gap-4">
           {[
             { label: t('TOTAL_ENTRIES'), val: '248', color: 'text-[#0DD9B0]' },
             { label: 'Uptime', val: '07:22:41', color: 'text-[#F59E0B]' },
           ].map((s, i) => (
             <div key={i} className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-4">
                <div className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-widest mb-1">{s.label}</div>
                <div className={`text-xl font-black ${s.color} font-mono tracking-tight`}>{s.val}</div>
             </div>
           ))}
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
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === lang.id ? 'bg-[#F59E0B] text-black shadow-lg shadow-[#F59E0B]/20' : 'bg-[#0D1421] text-[#6B7FA8] border border-[#1E2D45]'}`}
                >
                  {lang.label}
                </button>
              ))}
           </div>
        </div>

        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 space-y-4">
           <div className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#1E2D45] pb-3 mb-2">Device Preferences</div>
           {[
             { id: 'vibrate', label: 'Vibration on scan success', icon: Vibrate },
             { id: 'sound', label: 'Sound on entry submitted', icon: Volume2 },
             { id: 'awake', label: 'Keep screen awake', icon: Zap },
           ].map((pref, i) => (
             <div key={i} className="flex items-center justify-between cursor-pointer" onClick={() => togglePref(pref.id)}>
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-[#080C14] border border-[#1E2D45] flex items-center justify-center">
                      <pref.icon size={16} className="text-[#6B7FA8]" />
                   </div>
                   <span className="text-xs font-black text-white uppercase tracking-wider">{pref.label}</span>
                </div>
                <div className={`w-10 h-5 rounded-full p-1 transition-all ${prefs[pref.id] ? 'bg-[#0DD9B0]' : 'bg-[#1E2D45]'}`}>
                   <div className={`w-3 h-3 rounded-full bg-[#080C14] transition-all ${prefs[pref.id] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
             </div>
           ))}
        </div>

        <button onClick={handleLogout} className="w-full h-14 border-2 border-[#F43F5E] text-[#F43F5E] font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-[#F43F5E]/10 active:scale-95 transition-all">
           <LogOut size={20} />
           {t('LOGOUT')}
        </button>
      </div>
    </div>
  );
};

/* ========================================
   GUARD APP — Main Shell
   ======================================== */
const GuardApp = () => {
  const { t } = useLanguage();
  const { mismatches = [] } = useSocket();
  const TABS = [
    { id: 'scan', label: t('SCANNER') || 'Scanner', path: '/guard', icon: Scan, exact: true },
    { id: 'history', label: t('HISTORY'), path: '/guard/history', icon: History, exact: false },
    { id: 'alerts', label: t('ALERTS'), path: '/guard/alerts', icon: AlertTriangle, exact: false, badge: mismatches.length || null },
    { id: 'profile', label: t('PROFILE'), path: '/guard/profile', icon: UserCircle, exact: false },
  ];

  return (
    <div className='max-w-sm mx-auto min-h-screen bg-[#080C14] relative overflow-x-hidden border-x border-[#FFFFFF08] shadow-[0_0_100px_rgba(0,0,0,1)]'>
      <div className="box-border flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<ScanTab />} />
            <Route path="/history" element={<HistoryTab />} />
            <Route path="/alerts" element={<AlertsTab />} />
            <Route path="/profile" element={<ProfileTab />} />
            <Route path="*" element={<Navigate to="/guard" replace />} />
          </Routes>
        </div>
        {/* Navigation spacer */}
        <div className="h-[100px] shrink-0 bg-gradient-to-t from-black to-transparent pointer-events-none"></div>
        <MobileBottomTabs tabs={TABS} />
      </div>
    </div>
  );
};

export default GuardApp;
