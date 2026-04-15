import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ChevronDown, Eye, EyeOff, Shield, Truck, Warehouse, Crown, Settings } from 'lucide-react';

const ROLES = [
  { id: 'GUARD', label: 'Security Guard', path: '/guard', color: '#F59E0B', icon: Shield, shortLabel: 'GUARD' },
  { id: 'DRIVER', label: 'Freight Driver', path: '/driver', color: '#38BDF8', icon: Truck, shortLabel: 'DRIVER' },
  { id: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager', path: '/manager/dashboard', color: '#0DD9B0', icon: Warehouse, shortLabel: 'MANAGER' },
  { id: 'ADMIN', label: 'System Admin', path: '/admin/dashboard', color: '#F43F5E', icon: Settings, shortLabel: 'ADMIN' }
];

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Set default credentials when role changes
  useEffect(() => {
    const emailPrefix = selectedRole.id === 'WAREHOUSE_MANAGER' ? 'manager' : selectedRole.id.toLowerCase().split('_')[0];
    setEmail(`${emailPrefix}@logivision.in`);
    setPassword('demo123');
  }, [selectedRole]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await login(email, password);
      navigate(selectedRole.path);
    } catch (error) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (role) => {
    setSelectedRole(role);
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;600;700&display=swap');

        @keyframes gridDrift {
          0% { background-position: 0px 0px; }
          100% { background-position: 40px 40px; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.06; }
          50% { opacity: 0.12; }
        }

        .login-fade-1 { animation: fadeInUp 0.5s ease-out 0.1s both; }
        .login-fade-2 { animation: fadeInUp 0.5s ease-out 0.2s both; }
        .login-fade-3 { animation: fadeInUp 0.5s ease-out 0.3s both; }
        .login-fade-4 { animation: fadeInUp 0.5s ease-out 0.45s both; }
        .login-fade-5 { animation: fadeInUp 0.5s ease-out 0.6s both; }
        .login-fade-6 { animation: fadeInUp 0.5s ease-out 0.75s both; }
        .login-slide-in { animation: slideInRight 0.5s ease-out 0.3s both; }

        .stat-card-1 { animation: fadeInUp 0.5s ease-out 0.4s both; }
        .stat-card-2 { animation: fadeInUp 0.5s ease-out 0.55s both; }
        .stat-card-3 { animation: fadeInUp 0.5s ease-out 0.7s both; }

        .login-grid-bg {
          background-image:
            linear-gradient(#1E2D45 1px, transparent 1px),
            linear-gradient(90deg, #1E2D45 1px, transparent 1px);
          background-size: 40px 40px;
          animation: gridDrift 20s linear infinite;
        }

        .login-glow {
          background: radial-gradient(ellipse 600px 400px at 50% 50%, rgba(245,158,11,0.08), transparent);
          animation: glowPulse 4s ease-in-out infinite;
        }

        .font-jb { font-family: 'JetBrains Mono', monospace; }
        .font-dm { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* =================== LEFT PANEL — BRAND SIDE =================== */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-[#080C14] overflow-hidden">
        {/* Animated Grid Background */}
        <div className="absolute inset-0 opacity-25 login-grid-bg"></div>

        {/* Amber glow blob */}
        <div className="absolute inset-0 login-glow pointer-events-none"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center max-w-md w-full">
          {/* Logo */}
          <div className="login-fade-1 mb-4 flex justify-center">
            <img src="/logo.png" alt="LogiVision Logo" className="h-28 w-auto object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
          </div>

          {/* Wordmark */}
          <h1 className="login-fade-2 font-jb font-bold tracking-tight mb-4" style={{ fontSize: '52px', lineHeight: 1 }}>
            <span className="text-[#E8F0FE]">Logi</span>
            <span className="text-[#F59E0B]">Vision</span>
          </h1>

          {/* Tagline */}
          <p className="login-fade-3 font-dm text-[#6B7FA8] text-base uppercase tracking-[0.15em] mb-12 text-center">
            Industrial Gate Management Platform
          </p>

          {/* Feature Stat Cards */}
          <div className="w-full space-y-3 mb-12">
            {[
              { val: '97%', desc: 'Faster Check-ins', color: 'text-[#0DD9B0]', cls: 'stat-card-1' },
              { val: '₹7,900', desc: 'Saved Per Gate Daily', color: 'text-[#F59E0B]', cls: 'stat-card-2' },
              { val: '15 sec', desc: 'Average Gate Time', color: 'text-[#0DD9B0]', cls: 'stat-card-3' },
            ].map((stat, i) => (
              <div key={i} className={`${stat.cls} bg-[#111827] border-l-[3px] border-l-[#F59E0B] border border-[#1E2D45] border-l-[#F59E0B] p-4 flex items-center gap-4`}>
                <span className={`font-jb font-bold text-[32px] leading-none ${stat.color}`} style={{ minWidth: '110px' }}>
                  {stat.val}
                </span>
                <span className="font-dm text-[13px] text-[#6B7FA8] leading-snug">
                  {stat.desc}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom Location Tag */}
          <div className="login-fade-6 font-jb text-[11px] text-[#3D4F6B] tracking-wide text-center">
            JNPT Hub Panvel • Nagpur MIHAN • Golden Quadrilateral
          </div>
        </div>
      </div>

      {/* =================== RIGHT PANEL — FORM SIDE =================== */}
      <div className="w-full lg:w-1/2 bg-[#0D1421] flex items-center justify-center p-6 sm:p-10 relative login-slide-in">
        {/* Amber top border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#F59E0B]"></div>

        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="lg:hidden flex items-center justify-center mb-1">
              <img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
            </div>
            <div>
              {/* Mobile-only wordmark */}
              <div className="lg:hidden font-jb font-bold text-xl mb-0.5">
                <span className="text-[#E8F0FE]">Logi</span><span className="text-[#F59E0B]">Vision</span>
              </div>
              <h2 className="font-dm text-[#E8F0FE] text-2xl font-semibold leading-tight">Sign In to Platform</h2>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm font-dm animate-fade-in">
              {error}
            </div>
          )}

          {/* Quick Access Role Chips */}
          <div className="mb-7">
            <div className="font-jb text-[10px] text-[#6B7FA8] uppercase tracking-[0.15em] mb-3">
              Quick Access — Select Role
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(role => {
                const isActive = selectedRole.id === role.id;
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleChipClick(role)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-jb font-medium border transition-all duration-200"
                    style={{
                      background: isActive ? `${role.color}20` : '#111827',
                      borderColor: isActive ? role.color : '#1E2D45',
                      color: isActive ? role.color : '#6B7FA8',
                      boxShadow: isActive ? `0 0 12px ${role.color}15` : 'none',
                    }}
                  >
                    <Icon size={12} />
                    {role.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Access Role Dropdown */}
            <div>
              <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">Access Role</label>
              <div className="relative">
                <select
                  value={selectedRole.id}
                  onChange={(e) => setSelectedRole(ROLES.find(r => r.id === e.target.value))}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] px-4 py-3 appearance-none outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm cursor-pointer"
                >
                  {ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown size={16} className="text-[#F59E0B]" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={16} className="text-[#6B7FA8]" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-4 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm placeholder-[#3D4F6B]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={16} className="text-[#6B7FA8]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-12 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6B7FA8] hover:text-[#F59E0B] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-[4px] py-[13px] flex items-center justify-center gap-2 font-jb font-bold text-sm tracking-[0.15em] text-black transition-all duration-200 disabled:opacity-60 disabled:cursor-wait group relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                height: '52px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(245,158,11,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-jb text-xs tracking-[0.15em]">AUTHENTICATING...</span>
                </div>
              ) : (
                <>
                  <span className="relative z-10">SIGN IN</span>
                  <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center mt-4">
              <span className="text-[#6B7FA8] text-sm font-dm">Don't have an account? </span>
              <Link to="/register" className="text-[#F59E0B] hover:text-[#D97706] text-sm font-dm font-medium transition-colors">
                Sign up here
              </Link>
            </div>

          </form>

          {/* Version Tag */}
          <div className="mt-8 text-center font-jb text-[10px] text-[#3D4F6B] tracking-wide">
            LogiVision v2.4.1
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
