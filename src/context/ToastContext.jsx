import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-20 right-4 sm:bottom-4 sm:right-4 z-[9999] flex flex-col gap-2 max-w-[350px] w-full px-4 sm:px-0 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto w-full flex items-start gap-3 p-4 rounded-lg shadow-xl border animate-[slideInRight_0.3s_ease-out] backdrop-blur-md
              ${toast.type === 'success' ? 'bg-[#0DD9B0]/10 border-[#0DD9B0] text-white shadow-[0_5px_15px_rgba(13,217,176,0.1)]' : ''}
              ${toast.type === 'error' ? 'bg-[#F43F5E]/10 border-[#F43F5E] text-white shadow-[0_5px_15px_rgba(244,63,94,0.1)]' : ''}
              ${toast.type === 'warning' ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-[0_5px_15px_rgba(245,158,11,0.1)]' : ''}
              ${toast.type === 'info' ? 'bg-[#38BDF8]/10 border-[#38BDF8] text-white shadow-[0_5px_15px_rgba(56,189,248,0.1)]' : ''}
            `}
          >
            <div className="shrink-0 mt-0.5">
               {toast.type === 'success' && <CheckCircle2 size={18} className="text-[#0DD9B0]" />}
               {toast.type === 'error' && <AlertTriangle size={18} className="text-[#F43F5E]" />}
               {toast.type === 'warning' && <AlertTriangle size={18} className="text-[#F59E0B]" />}
               {toast.type === 'info' && <Info size={18} className="text-[#38BDF8]" />}
            </div>
            
            <div className="flex-1 font-sans text-sm font-medium leading-relaxed pt-px">
              {toast.message}
            </div>
            
            <button 
              onClick={() => removeToast(toast.id)} 
              className="shrink-0 text-gray-400 hover:text-white transition-colors p-1 -mr-2 -mt-1"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
