import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ChevronDown, Eye, EyeOff, User, Phone, Warehouse, Truck, ShieldCheck, Settings, Globe } from 'lucide-react';

const REGISTRATION_ROLES = [
    { id: 'DRIVER', label: 'Freight Driver', color: '#38BDF8', icon: Truck, shortLabel: 'DRIVER' },
    { id: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager', color: '#0DD9B0', icon: Warehouse, shortLabel: 'MANAGER' },
    { id: 'GUARD', label: 'Security Guard', color: '#F87171', icon: ShieldCheck, shortLabel: 'GUARD' },
    { id: 'ADMIN', label: 'System Admin', color: '#F59E0B', icon: Settings, shortLabel: 'ADMIN' },
];

const Register = () => {
    const [selectedRole, setSelectedRole] = useState(REGISTRATION_ROLES[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    // Form fields
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        warehouseId: 'WH-001', // Default for now, ideally a dropdown of active warehouses
        language: 'en',
    });

    const { setAuthData } = useAuth();
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    role: selectedRole.id
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to register');
            }

            // Registration successful, log them in using the helper
            setAuthData(data.data.user, data.data.token);

            // Redirect based on role
            const role = data.data.user.role;
            if (role === 'ADMIN' || role === 'AUTHORITY') {
                navigate('/admin/dashboard');
            } else if (role === 'DRIVER') {
                navigate('/driver');
            } else if (role === 'GUARD') {
                navigate('/guard');
            } else {
                navigate('/manager/dashboard');
            }

        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
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
        .login-slide-in { animation: slideInRight 0.5s ease-out 0.3s both; }

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

                    <div className="login-fade-3 mt-12 p-6 border border-[#1E2D45] bg-[#111827] rounded-lg">
                        <h3 className="text-[#E8F0FE] font-dm font-semibold mb-2">Join the Network</h3>
                        <p className="text-[#6B7FA8] font-dm text-sm leading-relaxed">
                            Register as a Driver to view active freight listings and accept loads, or register as a Warehouse Manager to oversee yard operations and inventory.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================== RIGHT PANEL — FORM SIDE =================== */}
            <div className="w-full lg:w-1/2 bg-[#0D1421] flex justify-center p-6 sm:p-10 relative login-slide-in overflow-y-auto">
                {/* Amber top border */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#F59E0B]"></div>

                <div className="w-full max-w-[420px] my-auto py-8">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                    <div className="lg:hidden flex items-center justify-center mb-1">
                        <img src="/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
                    </div>
                        <div>
                            <div className="lg:hidden font-jb font-bold text-xl mb-0.5">
                                <span className="text-[#E8F0FE]">Logi</span><span className="text-[#F59E0B]">Vision</span>
                            </div>
                            <h2 className="font-dm text-[#E8F0FE] text-2xl font-semibold leading-tight">Create an Account</h2>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm font-dm">
                            {error}
                        </div>
                    )}

                    {/* Registration Form */}
                    <form onSubmit={handleRegister} className="space-y-4">

                        {/* Role Selection Tabs */}
                        <div className="mb-6">
                            <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">I am signing up as a...</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {REGISTRATION_ROLES.map(role => {
                                    const isActive = selectedRole.id === role.id;
                                    const Icon = role.icon;
                                    return (
                                        <button
                                            key={role.id}
                                            type="button"
                                            onClick={() => setSelectedRole(role)}
                                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-[4px] border transition-all duration-200"
                                            style={{
                                                background: isActive ? `${role.color}15` : '#111827',
                                                borderColor: isActive ? role.color : '#1E2D45',
                                                color: isActive ? role.color : '#6B7FA8',
                                            }}
                                        >
                                            <Icon size={20} />
                                            <span className="font-jb text-xs font-semibold">{role.shortLabel}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">Full Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User size={16} className="text-[#6B7FA8]" />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Ramesh Patil"
                                    className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-4 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm placeholder-[#3D4F6B]"
                                />
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
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="name@example.com"
                                    className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-4 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm placeholder-[#3D4F6B]"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">Phone Number</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Phone size={16} className="text-[#6B7FA8]" />
                                </div>
                                <input
                                    type="tel"
                                    name="phone"
                                    required
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="+91 98765 43210"
                                    className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-4 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm placeholder-[#3D4F6B]"
                                />
                            </div>
                        </div>

                        {/* Language Preference */}
                        <div>
                            <label className="font-jb text-[11px] text-[#6B7FA8] uppercase tracking-[0.12em] block mb-2">Preferred Language</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Globe size={16} className="text-[#6B7FA8]" />
                                </div>
                                <select
                                    name="language"
                                    value={formData.language}
                                    onChange={handleInputChange}
                                    className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-4 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm appearance-none cursor-pointer"
                                    style={{ WebkitAppearance: 'none' }}
                                >
                                    <option value="en">English (English)</option>
                                    <option value="hi">हिंदी (Hindi)</option>
                                    <option value="mr">मराठी (Marathi)</option>
                                </select>
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <ChevronDown size={16} className="text-[#6B7FA8]" />
                                </div>
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
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Min 6 chars, 1 uppercase, 1 number"
                                    className="w-full bg-[#111827] border border-[#1E2D45] text-[#E8F0FE] rounded-[4px] pl-11 pr-12 py-3 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/30 transition-all font-dm text-sm placeholder-[#3D4F6B]"
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

                        {/* Sign Up Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-4 rounded-[4px] py-[13px] flex items-center justify-center gap-2 font-jb font-bold text-sm tracking-[0.15em] text-black transition-all duration-200 disabled:opacity-60 disabled:cursor-wait group relative overflow-hidden"
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
                                    <span className="font-jb text-xs tracking-[0.15em]">REGISTERING...</span>
                                </div>
                            ) : (
                                <>
                                    <span className="relative z-10">CREATE ACCOUNT</span>
                                    <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <div className="text-center mt-3 pt-3">
                            <span className="text-[#6B7FA8] text-sm font-dm">Already have an account? </span>
                            <Link to="/login" className="text-[#F59E0B] hover:text-[#D97706] text-sm font-dm font-medium transition-colors">
                                Sign in here
                            </Link>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;
