import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MobileBottomTabs from '../../components/layout/MobileBottomTabs';
import { Scan, History, AlertTriangle, UserCircle, Camera, CheckSquare, XSquare, FileText, ArrowLeft, LogOut, Volume2, Vibrate, RefreshCw, CheckCircle2, Truck, Shield, Clock, BarChart3, Info, AlertOctagon, ShieldCheck, Edit } from 'lucide-react';
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
  const [flowScreen, setFlowScreen] = useState('EWB_HERO');
  const [ewbNumber, setEwbNumber] = useState('');
  const [isEwbVerified, setIsEwbVerified] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [challanSource, setChallanSource] = useState('ocr');
  const [entryPassNumber, setEntryPassNumber] = useState('');
  const [extractedChallanData, setExtractedChallanData] = useState(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [scanMethod, setScanMethod] = useState('ocr');
  const [manualData, setManualData] = useState({ challanId: '', vehicleNo: '', from: '', to: '', items: '', weight: '', value: '', capacity: '' });
  const [showEchallanInput, setShowEchallanInput] = useState(false);
  const [echallanNumber, setEchallanNumber] = useState('');
  const [isEchallan, setIsEchallan] = useState(false);

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
  const ewbInputRef = React.useRef(null);

  // Parsed data
  const [plateData, setPlateData] = useState({ plate: '', details: '' });

  const playSuccessSound = () => {
    if (localStorage.getItem('setting_audio') !== 'false') {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch(e) {}
    }
  };

  const triggerVibrate = () => {
    if (localStorage.getItem('setting_vibrate') !== 'false' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if (localStorage.getItem('setting_awake') === 'true' && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {}
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (wakeLock !== null) wakeLock.release().catch(() => {});
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Offline Sync Management
  useEffect(() => {
    const savedQueue = JSON.parse(localStorage.getItem('offline_entry_queue') || '[]');
    setOfflineQueue(savedQueue);

    const syncQueue = async () => {
      const queue = JSON.parse(localStorage.getItem('offline_entry_queue') || '[]');
      if (queue.length === 0) return;

      for (const entry of queue) {
        try {
          const res = await fetch('/api/entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(entry)
          });
          const data = await res.json();
          if (data.success) {
            showToast(`✓ Queued truck ${entry.vehicleNo} synced`, 'success');
          }
        } catch (err) {
          console.error('Queue sync error', err);
        }
      }
      localStorage.setItem('offline_entry_queue', '[]');
      setOfflineQueue([]);
    };

    const handleOnline = () => {
      setIsOffline(false);
      showToast('Connection Restored — Syncing queue...', 'success');
      syncQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) syncQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const resetFlow = () => {
    setPlateDone(false);
    setChallanDone(false);
    setLoadCheck(null);
    setScanAnim('IDLE');
    setScanTarget(null);
    setChallanSource('ocr');
    setFlowScreen('EWB_HERO');
    setEwbNumber('');
    setIsEwbVerified(false);
    setEntryPassNumber('');
    setPlateImage(null);
    setChallanImage(null);
    setPlateData({ plate: '', details: '' });
    setExtractedChallanData(null);
    setIsManualMode(false);
    setScanMethod('ocr');
    setManualData({ challanId: '', vehicleNo: '', from: '', to: '', items: '', weight: '', value: '', capacity: '' });
    setLoadPhoto(null);
    setIsEchallan(false);
    setShowEchallanInput(false);
    setEchallanNumber('');
  };

  const handleEwbLookup = async () => {
    if (!ewbNumber || ewbNumber.length < 5) {
      showToast('Enter valid E-Way Bill number', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/ewb/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ ewb_number: ewbNumber })
      });

      const data = await res.json();
      if (data.success) {
        setExtractedChallanData(data.data);
        setPlateData({ plate: data.data.vehicleNo, details: '' });
        setChallanSource('ewb');
        setIsEwbVerified(true);
        triggerVibrate();
        showToast('✓ EWB Details Fetched Successfully', 'success');
        setFlowScreen('MAIN'); // Go to summary review then vibe check
        setChallanDone(true);
        setPlateDone(true);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      showToast(err.message || 'Lookup failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanPlate = () => {
    const input = plateInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  };
  const handleScanChallan = () => {
    setShowChallanPreview(false);
    const input = challanInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  };
  const handleGalleryChallan = () => {
    setShowChallanPreview(false);
    const input = galleryChallanInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  };
  const handleScanLoad = () => {
    const input = loadInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  };

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
            triggerVibrate();
            setScanAnim('DONE');
            setPlateDone(true);
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
        triggerVibrate();
        showToast(`✓ AI Scan Complete — ${result.data.scan_confidence?.toUpperCase()} confidence`, 'success');
        setScanAnim('DONE');
        setChallanDone(true);

        if (result.data.scan_confidence === 'low') {
          setTimeout(() => {
            toggleManualMode(result.data);
            showToast('Auto-opening manual entry for low confidence scan', 'info');
          }, 800);
        }
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

  const handleImportEchallan = async () => {
    if (!echallanNumber) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/echallaan/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ challanNumber: echallanNumber })
      });
      const result = await response.json();
      if (result.success) {
        setExtractedChallanData({
          challanId: result.data.challan_number,
          vehicleNo: result.data.truck_number,
          vendorName: result.data.from,
          destination: result.data.to,
          goodsDescription: result.data.goods_description,
          totalWeight: result.data.weight,
          totalValue: result.data.total_value,
          declaredLoad: result.data.capacity,
          e_way_bill_number: result.data.e_way_bill_number
        });
        setIsEchallan(true);
        setPlateData({ plate: result.data.truck_number, details: '' });
        setPlateDone(true);
        setChallanDone(true);
        setShowEchallanInput(false);
        setScanMethod('echallan');
        triggerVibrate();
        showToast('✓ E-Challan Imported Successfully', 'success');
      } else {
        throw new Error(result.message);
      }
    } catch(err) {
      showToast(err.message || 'Failed to import E-Challan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleManualMode = (incomingData = null) => {
    const data = incomingData || extractedChallanData;
    if (!isManualMode) {
      setManualData({
        challanId: data?.challanId || '',
        vehicleNo: data?.vehicleNo || plateData.plate || '',
        from: data?.vendorName || '',
        to: data?.destination || '',
        items: data?.goodsDescription || '',
        weight: data?.totalWeight || '',
        value: data?.totalValue || '', 
        capacity: data?.declaredLoad || ''
      });
    }
    setIsManualMode(!isManualMode);
    setScanMethod(!isManualMode ? 'manual' : 'ocr');
  };

  const handleSubmitEntry = async (overrideData = null) => {
    setIsLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const isEntryPass = challanSource === 'entry_pass';

      const normalize = (val) => val ? val.toString().replace(/[^A-Z0-9]/ig, '').toUpperCase() : '';
      const plate = normalize(overrideData?.vehicleNo || plateData.plate);
      const challan = normalize(overrideData?.challanId || extractedChallanData?.vehicleNo || manualData.vehicleNo);
      
      const isPlateMatch = isManualMode || isEntryPass || (plate === challan);
      const declared = isEntryPass ? 'FULL' : (isManualMode ? manualData.capacity : (extractedChallanData?.declaredLoad || 'EMPTY'));
      const isLoadMatch = loadCheck === declared;

      // For the demo, we allow mismatch but show a warning
      if (!isPlateMatch && !isEscalated && !isManualMode) {
        setMismatchCount(prev => prev + 1);
        showToast('⚠️ Vehicle No Mismatch — Manual override enabled', 'warning');
      }

      const entryData = isManualMode ? {
        challanId: manualData.challanId || 'MANUAL',
        vehicleNo: manualData.vehicleNo,
        vendorName: manualData.from,
        destination: manualData.to,
        goodsDescription: manualData.items,
        totalWeight: manualData.weight || '0',
        totalValue: manualData.value || '0',
        declaredLoad: manualData.capacity,
        dockAssigned: manualData.to && manualData.to.length <= 6 ? manualData.to : '', // Auto-map if it looks like a dock ID
        visualLoad: loadCheck,
        status: 'PENDING',
        scan_method: 'manual',
        imageUrl: challanImage,
        vehicleImageUrl: loadPhoto,
        eway_bill_number: extractedChallanData?.e_way_bill_number || null
      } : {
        challanId: isEntryPass ? entryPassNumber : (extractedChallanData?.challanId || 'OCR_REF_MISSING'),
        vehicleNo: isEntryPass ? (overrideData?.vehicleNo || 'PRE-VERIFIED') : plateData.plate,
        vendorName: isEntryPass ? 'ENTRY PASS SYSTEM' : extractedChallanData?.vendorName,
        destination: isEntryPass ? 'VERIFIED_GATE' : extractedChallanData?.destination,
        goodsDescription: isEntryPass ? 'Digital Pass Verified' : extractedChallanData?.goodsDescription,
        totalWeight: isEntryPass ? 'N/A' : (extractedChallanData?.totalWeight || '0'),
        totalValue: isEntryPass ? 'N/A' : (extractedChallanData?.totalValue || '0'),
        declaredLoad: declared,
        dockAssigned: extractedChallanData?.destination && extractedChallanData.destination.length <= 6 ? extractedChallanData.destination : '', 
        visualLoad: loadCheck,
        status: 'PENDING',
        scan_method: isEntryPass ? 'entry_pass' : (challanSource === 'ewb' ? 'ewb' : scanMethod),
        imageUrl: challanImage,
        vehicleImageUrl: loadPhoto,
        eway_bill_number: extractedChallanData?.eway_bill_number || ewbNumber || null,
        challan_source: challanSource
      };

      if (!navigator.onLine) {
        const queuedEntry = { ...entryData, status: 'queued', createdAt: new Date().toISOString() };
        const newQueue = [...offlineQueue, queuedEntry];
        setOfflineQueue(newQueue);
        localStorage.setItem('offline_entry_queue', JSON.stringify(newQueue));
        playSuccessSound();
        showToast('OFFLINE — Entry saved to local queue', 'warning');
        setFlowScreen('VERIFIED'); // Show success screen even offline
        setIsLoading(false);
        return;
      }

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
        playSuccessSound();
        showToast(isLoadMatch ? 'Entry Verified & Logged' : 'Mismatch Logged — Manager Notified', 'success');
        setFlowScreen(isLoadMatch ? 'VERIFIED' : 'MISMATCH');
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
  if (flowScreen === 'EWB_HERO') {
    return (
      <div className="flex flex-col h-full bg-[#080C14]">
        {/* Top Branding Bar */}
        <div className="px-6 py-4 bg-[#0D1421] border-b border-[#FFFFFF08] flex justify-between items-center shrink-0">
           <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0DD9B0] animate-pulse"></div>
              <span className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-[0.2em]">LogiVision Secure Node · GATE ENTRY SYSTEM</span>
           </div>
           <Shield size={14} className="text-[#1E2D45]" />
        </div>

        <div className="flex-1 px-8 pt-6 pb-24 flex flex-col justify-start gap-6 overflow-y-auto">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none italic">INCOMING<br/><span className="text-[#0DD9B0] not-italic">ARRIVALS</span></h1>
            <div className="flex items-center gap-2">
               <div className="w-4 h-0.5 bg-[#0DD9B0]"></div>
               <p className="text-[9px] text-[#6B7FA8] font-black uppercase tracking-[0.2em]">Gate Entry Verification</p>
            </div>
          </div>

          <div className="space-y-4">
             <div className="relative group">
                <label className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-[0.2em] mb-3 block ml-1 opacity-60">Scan Target: E-Way Bill Number</label>
                <input 
                   ref={ewbInputRef}
                   type="text" 
                   inputMode="numeric"
                   value={ewbNumber}
                   onChange={(e) => setEwbNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                   placeholder="12-DIGIT EWB NO." 
                   className="w-full h-16 bg-[#0D1421] border-2 border-[#1E2D45] rounded-2xl px-6 text-xl font-mono text-[#F59E0B] focus:border-[#F59E0B] focus:bg-[#080C14] outline-none transition-all placeholder:text-[#1A2235] tracking-[0.1em] text-center shadow-xl"
                />
                <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 px-3 py-1 bg-[#111827] border border-[#1E2D45] rounded-full flex items-center gap-2 pointer-events-none">
                   <ShieldCheck size={10} className="text-[#6B7FA8]" />
                   <span className="text-[7px] font-black text-[#6B7FA8] uppercase tracking-widest">Active Verification Layer</span>
                </div>
             </div>

             <div className="space-y-3">
               <button 
                 disabled={isLoading || ewbNumber.length < 5}
                 onClick={handleEwbLookup}
                 className="w-full h-14 bg-[#F59E0B] text-black rounded-2xl font-black tracking-widest uppercase shadow-xl shadow-[#F59E0B]/10 flex flex-col items-center justify-center active:scale-[0.97] transition-all disabled:opacity-20 disabled:grayscale"
               >
                 <div className="flex items-center gap-3">
                   {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                   <span className="text-sm">{isLoading ? 'SECURE FETCHING...' : 'FETCH GOVT DATA'}</span>
                 </div>
               </button>
               {isLoading && (
                 <div className="flex flex-col items-center gap-1 animate-pulse">
                    <span className="text-[7px] font-black text-[#F59E0B] uppercase tracking-[0.3em]">Verifying with GST Portal...</span>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#F59E0B] animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1 h-1 rounded-full bg-[#F59E0B] animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1 h-1 rounded-full bg-[#F59E0B] animate-bounce"></div>
                    </div>
                 </div>
               )}
             </div>
          </div>

          <div className="space-y-4">
             <p className="text-[8px] font-black text-[#3D4F6B] uppercase tracking-[0.4em] text-center">Or use Fallback Entry Methods</p>
             
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { setChallanSource('ocr'); setFlowScreen('MAIN'); }}
                  className="flex flex-col items-center gap-2 p-4 bg-[#111827] border border-[#1E2D45] rounded-2xl active:scale-95 transition-all group"
                >
                   <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                      <Camera size={20} />
                   </div>
                   <div className="text-center">
                     <div className="text-[9px] font-black text-white uppercase tracking-widest leading-tight">Handwritten</div>
                     <div className="text-[7px] text-[#6B7FA8] font-bold uppercase truncate">Challan Scan</div>
                   </div>
                </button>

                <button 
                  onClick={() => { setChallanSource('entry_pass'); setFlowScreen('ENTRY_PASS_INPUT'); }}
                  className="flex flex-col items-center gap-2 p-4 bg-[#111827] border border-[#1E2D45] rounded-2xl active:scale-95 transition-all group"
                >
                   <div className="w-10 h-10 rounded-xl bg-[#0DD9B0]/10 flex items-center justify-center text-[#0DD9B0]">
                      <FileText size={20} />
                   </div>
                   <div className="text-center">
                     <div className="text-[9px] font-black text-white uppercase tracking-widest leading-tight">Digital</div>
                     <div className="text-[7px] text-[#0DD9B0] font-bold uppercase truncate">Entry Pass</div>
                   </div>
                </button>
             </div>

             <button 
                onClick={() => { toggleManualMode(); setFlowScreen('MAIN'); }}
                className="w-full py-4 bg-[#0D1421] border border-[#1E2D45] rounded-xl flex items-center justify-center gap-3 text-[9px] font-black text-[#6B7FA8] uppercase tracking-[0.2em] hover:text-white transition-all shadow-lg active:scale-95"
             >
                <Edit size={14} className="text-[#F59E0B]" />
                Full Manual Form Entry
             </button>
          </div>
        </div>

        <div className="pb-8 pt-4 flex flex-col items-center gap-2 opacity-30 mt-auto">
           <div className="flex items-center gap-2">
              <Shield size={10} className="text-[#3D4F6B]" />
              <span className="text-[8px] font-black text-[#3D4F6B] uppercase tracking-[0.3em]">LogiVision Secure Node v2.0</span>
           </div>
        </div>
      </div>
    );
  }

  if (flowScreen === 'GATE_SELECTION') {
    return (
      <div className="flex flex-col h-full bg-[#080C14] px-6 py-8 overflow-y-auto pb-24">
        <button onClick={() => setFlowScreen('EWB_HERO')} className="w-10 h-10 rounded-full bg-[#111827] border border-[#1E2D45] flex items-center justify-center text-white mb-4">
           <ArrowLeft size={18} />
        </button>
        <div className="mb-10">
          <h1 className="text-3xl font-black text-white tracking-widest uppercase">Select Entry Workflow</h1>
          <p className="text-xs text-[#6B7FA8] font-bold uppercase tracking-widest mt-2 border-l-2 border-[#F59E0B] pl-3">Industrial Hub Gate 03</p>
        </div>

        <div className="space-y-6">
          <button 
            onClick={() => { setChallanSource('ocr'); setFlowScreen('MAIN'); }}
            className="w-full bg-[#111827] border border-[#1E2D45] rounded-[32px] p-8 text-left group active:scale-[0.98] transition-all hover:border-[#F59E0B]/50"
          >
            <div className="flex justify-between items-start mb-6">
               <div className="p-4 bg-[#F59E0B]/10 rounded-2xl text-[#F59E0B] group-hover:scale-110 transition-transform">
                  <Scan size={32} />
               </div>
               <div className="px-3 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-black tracking-widest rounded-full">AI ENABLED</div>
            </div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-2">Scan Physical Challan</h2>
            <p className="text-[10px] text-[#6B7FA8] leading-relaxed uppercase font-bold tracking-wider">Use for paper challans. Runs full OCR and matches vehicle plates automatically.</p>
          </button>

          <button 
            onClick={() => { setChallanSource('entry_pass'); setFlowScreen('ENTRY_PASS_INPUT'); }}
            className="w-full bg-[#111827] border border-[#1E2D45] rounded-[32px] p-8 text-left group active:scale-[0.98] transition-all hover:border-[#0DD9B0]/50"
          >
            <div className="flex justify-between items-start mb-6">
               <div className="p-4 bg-[#0DD9B0]/10 rounded-2xl text-[#0DD9B0] group-hover:scale-110 transition-transform">
                  <FileText size={32} />
               </div>
               <div className="px-3 py-1 bg-[#0DD9B0]/10 text-[#0DD9B0] text-[8px] font-black tracking-widest rounded-full">FAST TRACK</div>
            </div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-2">Entry Pass Integration</h2>
            <p className="text-[10px] text-[#6B7FA8] leading-relaxed uppercase font-bold tracking-wider">Skips OCR. Direct to Vibe Check for trucks with pre-existing digital passes.</p>
          </button>
        </div>

        <div className="mt-auto pb-10 flex items-center justify-center gap-2">
           <Shield size={14} className="text-[#3D4F6B]" />
           <span className="text-[9px] font-black text-[#3D4F6B] uppercase tracking-[0.2em]">Secured by LogiVision AI 2.0</span>
        </div>
      </div>
    );
  }

  if (flowScreen === 'ENTRY_PASS_INPUT') {
    return (
      <div className="flex flex-col h-full bg-[#080C14] px-6 py-8">
        <button onClick={() => setFlowScreen('EWB_HERO')} className="w-10 h-10 rounded-full bg-[#111827] border border-[#1E2D45] flex items-center justify-center text-white mb-8">
           <ArrowLeft size={18} />
        </button>
        
        <div className="mb-10">
          <h2 className="text-2xl font-black text-[#0DD9B0] tracking-widest uppercase mb-2">Verification Layer</h2>
          <p className="text-[10px] btext-[#6B7FA8] uppercase font-bold tracking-widest">Connect with Warehouse ERP</p>
        </div>

        <div className="bg-[#111827] border border-[#1E2D45] rounded-[32px] p-8 space-y-6">
           <div>
              <label className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-[0.2em] mb-3 block">Digital Pass ID / Challan No</label>
              <input 
                type="text" 
                value={entryPassNumber}
                onChange={(e) => setEntryPassNumber(e.target.value.toUpperCase())}
                placeholder="EP-2024-XXXXX" 
                className="w-full h-16 bg-[#080C14] border border-[#1E2D45] rounded-2xl px-6 text-xl font-mono text-white focus:border-[#0DD9B0] outline-none transition-all placeholder:text-[#3D4F6B]"
              />
           </div>
           <button 
             onClick={() => {
                if(!entryPassNumber) return alert('Enter Pass Number');
                setFlowScreen('VIBE_CHECK_DIRECT');
             }}
             className="w-full bg-[#0DD9B0] text-black h-16 rounded-2xl font-black tracking-widest uppercase shadow-lg shadow-[#0DD9B0]/10 flex items-center justify-center gap-3"
           >
              Next Step: Load Check <Scan size={20} />
           </button>
        </div>
      </div>
    );
  }

  if (flowScreen === 'VIBE_CHECK_DIRECT') {
    return (
      <div className="flex flex-col h-full bg-[#080C14] px-6 py-8 overflow-y-auto">
         <button onClick={() => setFlowScreen('ENTRY_PASS_INPUT')} className="w-10 h-10 rounded-full bg-[#111827] border border-[#1E2D45] flex items-center justify-center text-white mb-8 shrink-0">
           <ArrowLeft size={18} />
        </button>

        <div className="mb-8">
          <div className="inline-block px-3 py-1 bg-[#0DD9B0]/10 text-[#0DD9B0] text-[8px] font-black tracking-widest rounded-full mb-3 uppercase">EP: {entryPassNumber}</div>
          <h2 className="text-2xl font-black text-white tracking-widest uppercase">Physical Load check</h2>
          <p className="text-[10px] text-[#6B7FA8] uppercase font-bold tracking-widest mt-1">Verify actual truck content</p>
        </div>

        {/* Load Photo */}
        <div className="mb-8">
          <div 
             onClick={handleScanLoad}
             className="aspect-video bg-[#111827] border-2 border-dashed border-[#1E2D45] rounded-3xl flex flex-col items-center justify-center gap-3 overflow-hidden relative"
          >
             {loadPhoto ? (
               <img src={loadPhoto} className="w-full h-full object-cover" />
             ) : (
               <>
                 <Camera size={32} className="text-[#3D4F6B]" />
                 <span className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-widest">Snap Truck Back (Optional)</span>
               </>
             )}
          </div>
          <input ref={loadInputRef} type="file" accept="image/*" capture="environment" onChange={handleLoadPhotoSelect} className="hidden" />
        </div>

        {/* Selector */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { id: 'FULL', label: 'FULL', icon: Truck, activeClass: 'border-[#0DD9B0] bg-[#0DD9B0]/10 text-white' },
            { id: 'HALF', label: 'HALF', icon: Truck, activeClass: 'border-[#F59E0B] bg-[#F59E0B]/10 text-white' },
            { id: 'EMPTY', label: 'EMPTY', icon: Truck, activeClass: 'border-white bg-white/10 text-white' },
          ].map(opt => (
            <button 
              key={opt.id}
              onClick={() => setLoadCheck(opt.id)}
              className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${loadCheck === opt.id ? opt.activeClass + ' scale-105 shadow-xl' : 'border-[#1E2D45] bg-[#111827] text-[#3D4F6B]'}`}
            >
                <opt.icon size={28} className={loadCheck === opt.id ? 'opacity-100' : 'opacity-40'} />
                <span className="text-[11px] font-black tracking-widest">{opt.label}</span>
            </button>
          ))}
        </div>

        <button 
           onClick={() => {
             handleSubmitEntry({
               vehicleNo: 'ENTRY_PASS_VERIFIED',
               challanId: entryPassNumber
             });
           }}
           disabled={!loadCheck || isLoading}
           className="w-full bg-[#0DD9B0] text-black h-20 rounded-[28px] font-black text-lg tracking-widest uppercase shadow-lg shadow-[#0DD9B0]/10 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
        >
           {isLoading ? 'SYNCING...' : 'FINALIZE ENTRY'}
        </button>
      </div>
    );
  }

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
      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-[#F59E0B] py-2 px-5 flex items-center justify-between shadow-lg animate-pulse z-[200]">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-black animate-spin" />
            <span className="text-[10px] font-black text-black uppercase tracking-widest">
              OFFLINE — {offlineQueue.length} ENTRIES QUEUED
            </span>
          </div>
          <span className="text-[8px] font-black text-black/60 uppercase">Rural Mode Active</span>
        </div>
      )}

      {/* 2026 Status Bar */}
      <div className="sticky top-0 z-[100] glass-header px-4 py-4 border-b border-[#1E2D45] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={resetFlow} className="w-9 h-9 rounded-full bg-[#111827] border border-[#1E2D45] flex items-center justify-center text-white active:scale-95 transition-all">
             <ArrowLeft size={18} />
          </button>
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
          
          <input type='file' accept='image/*' capture='environment' ref={plateInputRef} style={{display:'none'}} onChange={handlePlateFileSelect} />
          <input type='file' accept='image/*' capture='environment' ref={challanInputRef} style={{display:'none'}} onChange={handleChallanFileSelect} />
          <input type='file' accept='image/*' ref={galleryChallanInputRef} style={{display:'none'}} onChange={handleChallanFileSelect} />
          <input type='file' accept='image/*' capture='environment' ref={loadInputRef} style={{display:'none'}} onChange={handleLoadPhotoSelect} />

          {/* Main Viewfinder / Direct Trigger */}
          <div className="relative">
            { (plateImage || challanImage || loadPhoto) ? (
              <div className="bg-industrial-gradient border border-[#1E2D45] rounded-[28px] overflow-hidden shadow-2xl relative p-2 shadow-amber-glow">
                <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden bg-black flex items-center justify-center border border-[#FFFFFF08]">
                  
                  {/* Visual Corner Brackets */}
                  <div className="corner-bracket bracket-tl"></div>
                  <div className="corner-bracket bracket-tr"></div>
                  <div className="corner-bracket bracket-bl"></div>
                  <div className="corner-bracket bracket-br"></div>

                  <div className="w-full h-full relative">
                    {plateImage && scanTarget === 'PLATE' ? (
                      <img src={plateImage} className="w-full h-full object-cover" alt="Plate" />
                    ) : challanImage && scanTarget === 'CHALLAN' ? (
                      <img src={challanImage} className="w-full h-full object-cover opacity-60 backdrop-sepia-[0.2]" alt="Challan" />
                    ) : loadPhoto ? (
                      <img src={loadPhoto} className="w-full h-full object-cover" alt="Load Evidence" />
                    ) : null}

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
            ) : (
              <div className="space-y-4">
                {/* Scan Challan Button */}
                <button 
                  onClick={handleScanChallan} 
                  disabled={scanAnim === 'PARSING'}
                  className="w-full bg-[#111827] border-2 border-[#F59E0B]/40 rounded-[24px] p-8 flex flex-col items-center justify-center gap-4 active:scale-[0.97] transition-all group"
                >
                  <div className="w-20 h-20 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center group-active:bg-[#F59E0B]/20 transition-colors">
                    <Camera size={36} className="text-[#F59E0B]" />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-white uppercase tracking-widest">Scan Challan</div>
                    <div className="text-[9px] font-bold text-[#6B7FA8] uppercase tracking-[0.2em] mt-1">Tap to Open Camera</div>
                  </div>
                </button>

                {/* Plate Scan Button */}
                <button 
                  onClick={handleScanPlate} 
                  className={`w-full rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-[0.97] transition-all ${
                    plateDone 
                      ? 'bg-[#0DD9B0]/10 border border-[#0DD9B0]/30' 
                      : 'bg-[#0D1421] border border-[#1E2D45]'
                  }`}
                >
                  <Camera size={18} className={plateDone ? 'text-[#0DD9B0]' : 'text-[#6B7FA8]'} />
                  <span className={`text-[11px] font-black uppercase tracking-widest ${plateDone ? 'text-[#0DD9B0]' : 'text-[#6B7FA8]'}`}>
                    {plateDone ? '✓ Plate Captured' : 'Scan Number Plate'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* AI Extraction Summary Card (Auto-appears after scan) */}
          {challanDone && extractedChallanData && !isManualMode && (
            <div className={`mx-5 bg-[#111827] border ${isEchallan ? 'border-[#0DD9B0]/40' : 'border-[#F59E0B]/30'} rounded-[28px] p-6 shadow-2xl animate-fade-in`}>
              <div className="flex items-center gap-3 mb-4 border-b border-[#1E2D45] pb-3">
                {isEwbVerified ? (
                  <div className="flex items-center gap-2 bg-[#0DD9B0]/20 text-[#0DD9B0] px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest border border-[#0DD9B0]/30 animate-pulse">
                    <ShieldCheck size={14} /> E-VERIFIED PORTAL
                  </div>
                ) : isEchallan ? (
                  <div className="flex items-center gap-2 bg-[#0DD9B0]/20 text-[#0DD9B0] px-2 py-1 rounded text-[10px] font-black tracking-widest">✓ E-VERIFIED</div>
                ) : (
                  <Shield size={20} className="text-[#F59E0B]" />
                )}
                <div className="flex flex-col">
                  <h3 className="text-white font-black text-xs tracking-widest uppercase">{isEwbVerified ? 'GOVERNMENT PORTAL DATA' : (isEchallan ? 'DIGITAL E-CHALLAN' : 'AI EXTRACTION REVIEW')}</h3>
                  {!isEwbVerified && !isEchallan && extractedChallanData?.scan_confidence && (
                    <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm w-fit mt-1 flex items-center gap-1 uppercase tracking-tighter ${
                      extractedChallanData.scan_confidence === 'high' ? 'bg-[#0DD9B0]/20 text-[#0DD9B0]' :
                      extractedChallanData.scan_confidence === 'medium' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                      'bg-[#F43F5E]/20 text-[#F43F5E]'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        extractedChallanData.scan_confidence === 'high' ? 'bg-[#0DD9B0]' :
                        extractedChallanData.scan_confidence === 'medium' ? 'bg-[#F59E0B]' :
                        'bg-[#F43F5E]'
                      }`}></div>
                      Confidence: {extractedChallanData.scan_confidence}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                {[
                  { label: 'CHALLAN ID', val: extractedChallanData.challanId },
                  { label: 'TRUCK NO', val: extractedChallanData.vehicleNo },
                  { label: 'FROM', val: extractedChallanData.vendorName },
                  { label: 'DOCK (TO)', val: extractedChallanData.destination },
                  { label: 'GOODS DESC', val: extractedChallanData.goodsDescription, req: true },
                  { label: 'WEIGHT', val: extractedChallanData.totalWeight },
                  { label: 'TOTAL VALUE', val: extractedChallanData.totalValue, req: true },
                ].map((item, i) => (
                  <div key={i} className={`flex justify-between items-center bg-[#080C14] px-4 py-3 rounded-xl border ${isEwbVerified ? 'border-[#0DD9B0]/10' : 'border-[#1E2D45]'}`}>
                    <span className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-wider">{item.label}</span>
                    {item.val && item.val !== 'null' && item.val !== 'N/A' ? (
                      <span className={`text-xs font-mono font-black ${isEwbVerified ? 'text-[#0DD9B0]' : 'text-white'}`}>{item.val}</span>
                    ) : (
                      <span className={`text-[10px] font-black uppercase ${item.req ? 'text-[#F43F5E] animate-pulse' : 'text-[#3D4F6B]'}`}>
                        {item.req ? '⚠️ NOT EXTRACTED' : 'Not Found'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {!isEwbVerified && (
                <div className="mt-6 flex flex-col gap-2">
                  <div className="text-[10px] text-[#6B7FA8] font-bold text-center uppercase mb-1">
                    Check Red fields above. Toggle Manual Entry if needed.
                  </div>
                  <button 
                    onClick={toggleManualMode}
                    className="w-full py-3 bg-[#1E2D45] text-white font-black text-[10px] uppercase rounded-xl border border-[#F59E0B]/20"
                  >
                    Edit / Fill Missing Fields
                  </button>
                </div>
              )}
              {isEwbVerified && (
                <div className="mt-4 p-3 bg-[#0DD9B0]/5 rounded-xl border border-[#0DD9B0]/20 text-center">
                   <p className="text-[9px] text-[#0DD9B0] font-black uppercase tracking-widest">Fields locked — Verified Govt Data</p>
                </div>
              )}
            </div>
          )}

          {/* Primary Scanner Action */}
          <div className="flex flex-col items-center gap-5">
            { (plateImage || challanImage || loadPhoto) && (
              mismatchCount < 4 ? (
                <button 
                  onClick={handleScanChallan} 
                  disabled={scanAnim === 'PARSING'}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-white h-16 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <Camera size={20} className="text-[#F59E0B]" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Retake / Scan More</span>
                </button>
              ) : (
                <button 
                  onClick={handleFlag}
                  className="w-full bg-[#F43F5E] text-white h-16 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <AlertOctagon size={20} />
                  <span className="text-[11px] font-black uppercase tracking-widest">MANAGER OVERRIDE</span>
                </button>
              )
            )}
            
            {showEchallanInput && (
              <div className="mx-5 mb-5 bg-[#111827] border border-[#0DD9B0]/50 rounded-[24px] p-6 shadow-2xl animate-fade-in relative w-full">
                <button onClick={() => setShowEchallanInput(false)} className="absolute top-4 right-4 text-[#6B7FA8] hover:text-white">&times;</button>
                <h3 className="text-[#0DD9B0] font-black text-xs tracking-widest uppercase mb-4">IMPORT DIGITAL GATE PASS</h3>
                <input type="text" value={echallanNumber} onChange={(e) => setEchallanNumber(e.target.value)} placeholder="Entry E-Challan Number" className="w-full bg-[#0D1421] border border-[#1E2D45] text-white p-3 rounded-lg mb-4 text-sm focus:ring-1 focus:ring-[#0DD9B0] focus:outline-none" />
                <button disabled={isLoading} onClick={handleImportEchallan} className="w-full bg-[#0DD9B0] text-black font-black py-3 rounded-xl shadow-lg shadow-[#0DD9B0]/20 disabled:opacity-50">
                  {isLoading ? 'IMPORTING...' : 'VERIFY & IMPORT API'}
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <button onClick={handleGalleryChallan} className="text-[10px] text-[#6B7FA8] font-bold uppercase tracking-widest border-b border-[#1E2D45] pb-0.5">GALLERY UPLOAD</button>
              <button onClick={() => { setShowEchallanInput(true); setShowChallanPreview(false); }} className="text-[10px] font-black text-[#6B7FA8] uppercase tracking-widest px-4 py-1.5 rounded-full border border-[#1E2D45] bg-[#1E2D45]">IMPORT E-CHALLAN</button>
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
                     { label: 'Consignment Entity (FROM)', key: 'from', placeholder: 'Vendor / Transporter', required: true },
                     { label: 'Logistics Dock (TO)', key: 'to', placeholder: 'D-07, B-12', required: true },
                     { label: 'Goods Description', key: 'items', placeholder: 'Electronics, Sensors, etc.', required: true },
                     { label: 'Declared Mass (Weight)', key: 'weight', placeholder: 'Mass in Tons' },
                     { label: 'Total Value (₹)', key: 'value', placeholder: 'Monetary Value', required: true },
                   ].map(f => (
                     <div key={f.key}>
                        <div className="flex justify-between items-center mb-1.5 ml-1">
                          <label className="text-[9px] font-black text-[#6B7FA8] uppercase tracking-[0.2em]">{f.label}</label>
                          {!manualData[f.key] && f.required && (
                            <span className="text-[8px] font-black text-[#F43F5E] uppercase animate-pulse">Required</span>
                          )}
                        </div>
                        <input 
                          type="text" 
                          placeholder={f.placeholder}
                          value={manualData[f.key]}
                          onChange={(e) => setManualData({...manualData, [f.key]: e.target.value})}
                          className={`w-full bg-[#080C14] border rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none transition-all placeholder:opacity-20 ${!manualData[f.key] && f.required ? 'border-[#F43F5E]/50' : 'border-[#1E2D45] focus:border-[#F59E0B]'}`}
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
               disabled={!loadPhoto || isLoading}
               className={`w-full h-14 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all ${
                 (!loadPhoto || isLoading) 
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
          <div key={item._id || item.challanId} className="bg-[#1A2235] border border-[#1E2D45] p-4 rounded-2xl flex items-center justify-between shadow-lg">
            <div>
              <div className="font-mono text-white font-black text-base">{item.vehicleNo || '—'}</div>
              <div className="text-[10px] text-[#6B7FA8] font-black uppercase mt-1">{item.vendorName || 'Manual Entry'}</div>
            </div>
            <div className="text-right">
              <StatusPill status={item.status || 'PENDING'} />
              <div className="text-[9px] text-[#6B7FA8] font-mono mt-1 uppercase">
                {item.scannedAt ? new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
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
            const id = alert._id || alert.challanId;
            const isEx = expandedCards.has(id);
            const timeAgo = alert.scannedAt 
              ? Math.floor((new Date() - new Date(alert.scannedAt)) / 60000) + "m ago" 
              : "just now";
            
            return (
              <div key={id} className="bg-[#1A2235] border border-l-4 border-l-[#F43F5E] border-[#1E2D45] rounded-xl overflow-hidden shadow-xl">
                 <div className="p-5 space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="font-mono text-lg font-black text-[#F59E0B]">{alert.vehicleNo || '—'}</span>
                       <span className="text-[9px] text-[#6B7FA8] font-bold uppercase">{timeAgo}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                       <div><span className="text-[#6B7FA8] uppercase font-black block mb-0.5">Declared</span><span className="text-white font-bold">{alert.declaredLoad}</span></div>
                       <div><span className="text-[#6B7FA8] uppercase font-black block mb-0.5">Visual</span><span className="text-[#F43F5E] font-black">{alert.visualLoad}</span></div>
                    </div>
                    <div className={`p-2 rounded text-[10px] font-black uppercase text-center ${alert.status === 'PENDING' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#F43F5E]/10 text-[#F43F5E]'}`}>
                       {alert.status === 'PENDING' ? 'Awaiting Manager Override' : alert.status}
                    </div>
                    <div className="flex gap-2 pt-2">
                       <button onClick={() => toggleCardExpansion(id)} className="flex-1 border border-[#1E2D45] text-white text-[10px] font-black py-2.5 rounded-lg uppercase tracking-wider">{isEx ? 'Hide Details' : 'Full Specs'}</button>
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

  // Reactive state for settings
  const [settings, setSettings] = useState({
    vibrate: localStorage.getItem('setting_vibrate') !== 'false',
    audio: localStorage.getItem('setting_audio') !== 'false',
    awake: localStorage.getItem('setting_awake') === 'true'
  });

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

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  const toggleSetting = (key) => {
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    localStorage.setItem(`setting_${key}`, newVal.toString());
    
    // Actually trigger or release wake lock if awake changed
    if (key === 'awake') {
       window.dispatchEvent(new CustomEvent('setting:awake:changed', { detail: newVal }));
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

        {/* Device Integration Preferences */}
        <div className="bg-[#111827] border border-[#1E2D45] rounded-2xl p-5 space-y-4">
           <div className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest border-b border-[#1E2D45] pb-3 mb-2">Device Integrations</div>
           {[
             { 
               id: 'setting_vibrate',
               label: 'Haptic Scan Confirm', 
               state: settings.vibrate, 
               icon: Vibrate,
               toggle: () => toggleSetting('vibrate')
             },
             { 
               id: 'setting_audio',
               label: 'Audio Entry Confirm', 
               state: settings.audio, 
               icon: Volume2,
               toggle: () => toggleSetting('audio')
             },
             { 
               id: 'setting_awake',
               label: 'Keep Screen Awake', 
               state: settings.awake, 
               icon: Clock,
               toggle: () => toggleSetting('awake')
             },
           ].map((pref, i) => (
             <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-[#080C14] border border-[#1E2D45] flex items-center justify-center">
                      <pref.icon size={16} className="text-[#6B7FA8]" />
                   </div>
                   <span className="text-xs font-black text-white uppercase tracking-wider">{pref.label}</span>
                </div>
                <button onClick={pref.toggle} className={`w-10 h-5 rounded-full p-0.5 transition-all ${pref.state ? 'bg-[#0DD9B0]' : 'bg-[#1E2D45]'}`}>
                   <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${pref.state ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
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
