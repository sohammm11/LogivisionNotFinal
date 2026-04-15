const fs = require('fs');
const path = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/manager/ManagerDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
  ['bg-[#080C14]', 'bg-slate-50'],
  ['bg-[#0D1421]', 'bg-white/90 backdrop-blur-md shadow-sm'],
  ['bg-[#111827]', 'bg-white'],
  ['text-[#E8F0FE]', 'text-slate-800'],
  ['text-[#6B7FA8]', 'text-slate-500'],
  ['border-[#1E2D45]', 'border-slate-200'],
  ['border-white/10', 'border-slate-200'],
  ['border-white/30', 'border-slate-300'],
  ['text-white/60', 'text-slate-500'],
  ['text-white/80', 'text-slate-600'],
  ['text-white', 'text-slate-800'],
  ['bg-white/10', 'bg-slate-50'],
  ['bg-black/50', 'bg-slate-900/40 backdrop-blur-sm'],
  
  // Specific buttons fix
  ['text-slate-800 font-bold', 'text-white font-bold'],
  ['bg-red-500 text-slate-800', 'bg-red-500 text-white'],
  ['bg-green-500 text-slate-800', 'bg-green-500 text-white'],
  ['bg-[#F59E0B] text-slate-800', 'bg-[#F59E0B] text-white'],
  ['bg-[#0DD9B0] text-slate-800', 'bg-[#0DD9B0] text-white'],
  ['bg-[#528FF0] text-slate-800', 'bg-[#528FF0] text-white'],
  
  // Animations and shadows for cards and boxes
  ['rounded-md p-5', 'rounded-xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1'],
  ['hover:bg-[#1E2D4550] transition-colors', 'hover:bg-slate-50 transition-all duration-300 hover:shadow-sm hover:-translate-y-[1px] hover:scale-[1.002] z-10 cursor-pointer'],
  ['border-b border-[#1E2D45]', 'border-b border-slate-100'],
  ['bg-[#0DD9B015]', 'bg-teal-50 hover:bg-teal-100'],
  ['bg-slate-50/50', 'bg-slate-100'],
  
  // specific tweaks for the tabs bar animation
  ['text-[#F59E0B]', 'text-[#F59E0B] bg-slate-50/80 rounded-t-lg'],
  ['hover:text-[#E8F0FE]', 'hover:text-slate-800'],
  ['h-[3px] bg-[#F59E0B]', 'h-[3px] bg-[#F59E0B] rounded-t-lg shadow-[0_-2px_8px_rgba(245,158,11,0.5)]']
];

for (const [search, replace] of replacements) {
  content = content.split(search).join(replace);
}

fs.writeFileSync(path, content);
console.log('Script 4 completed');
