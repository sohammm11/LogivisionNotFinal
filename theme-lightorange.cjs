const fs = require('fs');

// --- MANAGER DASHBOARD ---
const mgrPath = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/manager/ManagerDashboard.jsx';
let mgr = fs.readFileSync(mgrPath, 'utf8');

const mgrReplace = [
    // Base theme colors
    ['bg-[#080C14]', 'bg-gradient-to-br from-orange-50/50 to-white bg-fixed relative overflow-hidden'],
    ['text-[#E8F0FE]', 'text-stone-800'],
    ['bg-[#0D1421]', 'bg-white/80 backdrop-blur-xl border-b border-orange-200/60 shadow-sm'],
    ['bg-[#111827]', 'bg-white'],
    ['text-[#6B7FA8]', 'text-orange-900/60'],
    ['border-[#1E2D45]', 'border-orange-100'],
    ['border-white/10', 'border-orange-100'],
    ['border-white/30', 'border-orange-300'],
    ['text-white/60', 'text-stone-500'],
    ['text-white/80', 'text-stone-600'],
    ['text-white', 'text-stone-800'],
    ['bg-white/10', 'bg-orange-50/80'],
    ['bg-black/50', 'bg-stone-900/20 backdrop-blur-md'],

    // Specific buttons fix to keep them legible
    ['text-stone-800 font-bold', 'text-white font-bold'],
    ['bg-red-500 text-stone-800', 'bg-red-500 text-white'],
    ['bg-green-500 text-stone-800', 'bg-green-500 text-white'],
    ['bg-[#0DD9B0] text-stone-800', 'bg-[#0DD9B0] text-white shadow-lg shadow-[#0DD9B0]/30 hover:-translate-y-1 transition-all'],
    ['bg-[#528FF0] text-stone-800', 'bg-[#528FF0] text-white'],
    ['bg-[#F59E0B] text-black', 'bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg shadow-orange-500/30 hover:-translate-y-1 transition-all'],
    ['bg-[#F59E0B] text-stone-800', 'bg-gradient-to-r from-orange-400 to-orange-500 text-white'],
    ['text-[#F59E0B]', 'text-orange-500 font-bold'],
    ['hover:bg-[#D97706]', 'hover:brightness-110'],
    ['border-[#0DD9B0] text-[#0DD9B0]', 'border-orange-400 text-orange-500 shadow-sm hover:-translate-y-0.5 transition-all'],
    ['hover:bg-[#0DD9B015]', 'hover:bg-orange-50'],

    // High-animation transformations
    ['rounded-md p-5', 'rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] box-border border-orange-100/50 hover:shadow-orange-400/20 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group'],
    ['hover:bg-[#1E2D4550]', 'hover:bg-orange-50/60 transition-all duration-300 hover:shadow-md hover:-translate-y-[2px] hover:scale-[1.005] z-10 cursor-pointer relative overflow-hidden'],
    ['bg-stone-50/50', 'bg-orange-50/70'],

    // tabs bar animation
    ['text-[#F59E0B]', 'text-orange-600 bg-orange-100/50 rounded-t-xl transition-all'],
    ['hover:text-[#E8F0FE]', 'hover:text-stone-800'],
    ['h-[3px] bg-[#F59E0B]', 'h-[3px] bg-gradient-to-r from-orange-400 to-orange-500 rounded-t-lg shadow-[0_-3px_12px_rgba(249,115,22,0.5)]'],

    // map styling fixes
    ['className=\"z-0\"', 'className="z-0 rounded-2xl overflow-hidden border-2 border-orange-100 shadow-[0_8px_30px_rgb(251,146,60,0.1)] transition-all duration-500 hover:shadow-orange-400/20 hover:shadow-2xl"'],

    // Icon / marker fixes
    ['bg-[#F59E0B]', 'bg-gradient-to-br from-orange-400 to-orange-500']
];

for (const [search, replace] of mgrReplace) {
    mgr = mgr.split(search).join(replace);
}

// Inject keyframes into Manager Dashboard 
if (!mgr.includes('dashboard-blob')) {
    mgr = mgr.replace(
        '<div className="min-h-screen',
        `<style>{\`
      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes pulse-soft { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } }
      .dashboard-blob-1 { position: absolute; max-width: 60vw; height: 60vh; background: radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%); top: -20%; left: -10%; animation: pulse-soft 8s ease-in-out infinite; pointer-events: none; z-index: 0; }
      .dashboard-blob-2 { position: absolute; max-width: 50vw; height: 50vh; background: radial-gradient(circle, rgba(253,186,116,0.15) 0%, transparent 70%); bottom: -10%; right: -5%; animation: pulse-soft 10s ease-in-out infinite reverse; pointer-events: none; z-index: 0; }
      .float-hover:hover { animation: float 3s ease-in-out infinite; }
    \`}</style>
    <div className="dashboard-blob-1"></div>
    <div className="dashboard-blob-2"></div>
    <div className="min-h-screen relative z-10`
    );
}
fs.writeFileSync(mgrPath, mgr);


// --- LOGIN DASHBOARD ---
const loginPath = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/Login.jsx';
let login = fs.readFileSync(loginPath, 'utf8');

const loginReplace = [
    // Backgrounds & Base Colors
    ['bg-[#080C14]', 'bg-orange-50/40 relative'],
    ['bg-[#0D1421]', 'bg-white/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(251,146,60,0.15)] border-l border-white/50'],
    ['bg-[#111827]', 'bg-white/90 shadow-sm border border-orange-100 hover:shadow-md hover:border-orange-200 transition-all duration-300'],
    ['text-[#E8F0FE]', 'text-stone-800'],
    ['text-[#6B7FA8]', 'text-stone-500'],
    ['border-[#1E2D45]', 'border-orange-100'],

    // Oranges
    ['text-[#F59E0B]', 'text-orange-500'],
    ['bg-[#F59E0B]', 'bg-gradient-to-r from-orange-400 to-orange-500 text-white'],
    ['border-l-[#F59E0B]', 'border-l-orange-500'],
    ['text-[#0DD9B0]', 'text-orange-400'], // change green text to light orange
    ['text-[#3D4F6B]', 'text-stone-400'],

    // Custom CSS replacements for grid, glow, and animations
    ['#1E2D45', 'rgba(251,146,60,0.1)'], // grid lines 
    ['rgba(245,158,11,0.08)', 'rgba(251,146,60,0.2)'], // glow blob
    ['rgba(245,158,11,0.12)', 'rgba(251,146,60,0.25)'], // logo shadow
    ['rgba(245,158,11,0.3)', 'rgba(251,146,60,0.4)'], // button hover shadow

    // Inputs
    ['bg-[#111827] border', 'bg-orange-50/50 border border-orange-200 focus:bg-white focus:shadow-[0_0_15px_rgba(251,146,60,0.15)]'],
    ['placeholder-[#3D4F6B]', 'placeholder-stone-400'],

    // Make cards float more visibly
    ['stat-card-1', 'stat-card-1 hover:-translate-y-2 transition-transform duration-300 cursor-default'],
    ['stat-card-2', 'stat-card-2 hover:-translate-y-2 transition-transform duration-300 cursor-default'],
    ['stat-card-3', 'stat-card-3 hover:-translate-y-2 transition-transform duration-300 cursor-default'],

    // Big button
    ['#F59E0B, #D97706', '#fb923c, #f97316'], // gradient lighter start, slightly deeper end
    ['text-black', 'text-white'],
    ['scale-[1]', 'scale-105'] // fix hover scaling
];

for (const [search, replace] of loginReplace) {
    login = login.split(search).join(replace);
}

// Role chip strings fix
login = login.replace(/'#111827'/g, "'#ffffff'");
login = login.replace(/'#1E2D45'/g, "'#fed7aa'");
login = login.replace(/'#6B7FA8'/g, "'#78716c'");

// Add a super-animated float keyframe to the login logo wrapper
login = login.replace(
    '<div className="login-fade-1 mb-3">',
    '<div className="login-fade-1 mb-3 animate-[float_4s_ease-in-out_infinite]">'
);

fs.writeFileSync(loginPath, login);
console.log('Light Orange & Deep Animated Theme applied');
