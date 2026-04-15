import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, LayoutGrid, Truck, FileBarChart, AlertTriangle } from 'lucide-react';
import { useSocket } from '../../services/SocketProvider';

const navItems = [
  { id: 'feed', label: 'Live Feed', icon: Activity, path: '/authority/dashboard' },
  { id: 'heatmap', label: 'Dock Heatmap', icon: LayoutGrid, path: '/authority/heatmap' },
  { id: 'tracker', label: 'Truck Tracker', icon: Truck, path: '/authority/tracker' },
  { id: 'reports', label: 'Reports', icon: FileBarChart, path: '/authority/reports' },
];

const Sidebar = () => {
  const { mismatches } = useSocket();
  const unresolvedCount = mismatches.length;

  return (
    <aside className="w-[240px] h-[calc(100vh-64px)] glass-card border-t-0 border-r border-b-0 border-l-0 flex flex-col justify-between hidden md:flex sticky top-16 bg-[#0D1421]">
      <div className="py-6 px-3 flex flex-col gap-2 relative">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.id === 'feed'}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-md transition-all text-sm font-medium
              ${isActive
                ? 'text-[#F59E0B] bg-[#F59E0B10] border-l-[3px] border-[#F59E0B] pl-[13px]'
                : 'text-[#6B7FA8] hover:bg-[#1A2235] hover:text-[#E8F0FE] border-l-[3px] border-transparent pl-[13px]'}
            `}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}

        <div className="mt-8 pt-6 border-t border-[#1E2D45]">
          <div className="px-4 mb-2 text-xs font-mono-data text-[#6B7FA8] uppercase tracking-wider">
            Alerts
          </div>
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-md text-[#F43F5E] hover:bg-[#F43F5E15] transition-colors border-l-[3px] border-transparent hover:border-[#F43F5E] pl-[13px]">
            <div className="flex items-center gap-3 text-sm font-medium">
              <AlertTriangle size={18} />
              Mismatches
            </div>
            {unresolvedCount > 0 && (
              <span className="bg-[#F43F5E] text-white text-[10px] font-mono-data font-bold px-2 py-0.5 rounded-sm">
                {unresolvedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-[#1E2D45] text-xs text-[#6B7FA8] font-mono-data">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#0DD9B0] rounded-full animate-pulse-slow"></span>
          <span>SYS: ONLINE</span>
        </div>
        <div className="mt-1 text-[#0DD9B0] flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#0DD9B0] rounded-full animate-pulse-slow"></span>
          SOCKET.IO CONNECTED
        </div>
        <div className="mt-2 text-[10px] opacity-50">LogiVision v2.4.1</div>
      </div>
    </aside>
  );
};

export default Sidebar;
