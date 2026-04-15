import React from 'react';
import { Bell, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ warehouseName = "JNPT Hub — Panvel" }) => {
  const { user, logout, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine top border color based on role
  const getRoleAccent = () => {
    if (role === 'WAREHOUSE_MANAGER') return 'border-[#F59E0B]';
    return 'border-[#0DD9B0]'; // Default Authority/Admin
  };

  return (
    <nav className={`h-16 w-full glass-card border-b border-[#1E2D45] flex items-center justify-between px-6 border-t-2 ${getRoleAccent()} sticky top-0 z-[1050] bg-[#080C14]`}>
      {/* Left: Logo */}
      <div className="flex items-center gap-4">
        <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
        <div className="text-xl font-bold tracking-tight">
          <span className="text-[#E8F0FE]">Logi</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F59E0B] to-[#0DD9B0]">Vision</span>
        </div>
      </div>

      {/* Center: Warehouse Selector */}
      <div className="hidden md:flex items-center">
        <select
          className="bg-[#1A2235] border border-[#1E2D45] text-[#E8F0FE] text-sm rounded-sm px-3 py-1.5 outline-none focus:border-[#F59E0B] transition-colors appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236B7FA8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px] bg-[right_10px_center] bg-no-repeat"
          defaultValue="JNPT"
        >
          <option value="JNPT">{warehouseName}</option>
          <option value="MIHAN">Nagpur MIHAN</option>
        </select>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-4">
        <div className="relative cursor-pointer hover:bg-[#1A2235] p-2 rounded-full transition-colors">
          <Bell size={20} className="text-[#6B7FA8] hover:text-[#E8F0FE]" />
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-[#F43F5E] rounded-full ring-2 ring-[#080C14]"></span>
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-[#1E2D45]">
          <div className="flex flex-col items-end mr-1">
            <span className="text-xs font-bold text-[#E8F0FE]">{user?.name || 'Guest User'}</span>
            <span className="text-[10px] font-mono-data text-[#6B7FA8]">{role || user?.role || 'GUEST'}</span>
          </div>
          <UserCircle size={28} className="text-[#6B7FA8]" />
          <button
            onClick={handleLogout}
            className="text-[#6B7FA8] hover:text-[#F43F5E] transition-colors p-1"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
