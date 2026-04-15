import React from 'react';

const StatusPill = ({ status, className = '' }) => {
  const getStyles = () => {
    switch (status.toUpperCase()) {
      case 'VERIFIED':
      case 'COMPLETED':
      case 'IN STOCK':
        return 'text-[#0DD9B0] bg-[#0DD9B015] border-l-[3px] border-[#0DD9B0]';
      case 'PENDING':
      case 'SCHEDULED':
      case 'LOW STOCK':
        return 'text-[#F59E0B] bg-[#F59E0B15] border-l-[3px] border-[#F59E0B]';
      case 'MISMATCH':
      case 'FLAGGED':
      case 'OUT OF STOCK':
        return 'text-[#F43F5E] bg-[#F43F5E15] border-l-[3px] border-[#F43F5E]';
      case 'SYNCING':
      case 'IN TRANSIT':
        return 'text-[#38BDF8] bg-[#38BDF815] border-l-[3px] border-[#38BDF8]';
      case 'OFFLINE':
        return 'text-[#F59E0B] bg-[#F59E0B15] border-l-[3px] border-[#F59E0B] opacity-80';
      case 'OVERTIME':
        return 'text-[#F43F5E] bg-[#F43F5E15] border-l-[3px] border-[#F43F5E] animate-pulse-fast';
      default:
        return 'text-[#6B7FA8] bg-[#1A2235] border-l-[3px] border-[#6B7FA8]';
    }
  };

  const isPulsingOffline = status.toUpperCase() === 'OFFLINE';
  
  return (
    <span 
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-mono-data uppercase tracking-wider
        ${getStyles()} 
        ${isPulsingOffline ? 'animate-pulse-slow' : ''}
        ${className}
      `}
    >
      {status}
    </span>
  );
};

export default StatusPill;
