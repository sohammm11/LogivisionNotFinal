const fs = require('fs');
const path = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/manager/ManagerDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
  ['bg-[#080C14]', 'bg-orange-50/50'],
  ['bg-[#0D1421]', 'bg-white/90 backdrop-blur-md shadow-sm border-b border-orange-200'],
  ['bg-[#111827]', 'bg-white'],
  ['text-[#E8F0FE]', 'text-slate-800'],
  ['text-[#6B7FA8]', 'text-slate-500'],
  ['border-[#1E2D45]', 'border-orange-200'],
  ['border-white/10', 'border-orange-100'],
  ['border-white/30', 'border-orange-300'],
  ['text-white/60', 'text-slate-500'],
  ['text-white/80', 'text-slate-600'],
  ['text-white', 'text-slate-800'],
  ['bg-white/10', 'bg-orange-100/50'],
  ['bg-black/50', 'bg-slate-900/40 backdrop-blur-sm'],
  
  // Specific buttons fix
  ['text-slate-800 font-bold', 'text-white font-bold'],
  ['bg-red-500 text-slate-800', 'bg-red-500 text-white'],
  ['bg-green-500 text-slate-800', 'bg-green-500 text-white'],
  ['bg-[#0DD9B0] text-slate-800', 'bg-[#0DD9B0] text-white'],
  ['bg-[#528FF0] text-slate-800', 'bg-[#528FF0] text-white'],
  ['bg-[#F59E0B] text-black', 'bg-orange-500 text-white'],
  ['bg-[#F59E0B] text-slate-800', 'bg-orange-500 text-white'],
  ['text-[#F59E0B]', 'text-orange-600 font-bold'],
  ['hover:bg-[#D97706]', 'hover:bg-orange-600'],
  ['border-[#0DD9B0] text-[#0DD9B0]', 'border-orange-500 text-orange-600'],
  ['hover:bg-[#0DD9B015]', 'hover:bg-orange-50'],
  
  // Animations and shadows for cards and boxes (Orange tinted)
  ['rounded-md p-5', 'rounded-xl p-5 shadow-sm shadow-orange-100/50 hover:shadow-lg hover:shadow-orange-200/50 transition-all duration-300 hover:-translate-y-1'],
  ['hover:bg-[#1E2D4550]', 'hover:bg-orange-50/80 transition-all duration-300 hover:shadow-sm hover:-translate-y-[1px] hover:scale-[1.002] z-10 cursor-pointer'],
  ['bg-slate-50/50', 'bg-orange-50'],
  
  // tabs bar animation
  ['text-[#F59E0B]', 'text-orange-600 bg-orange-50 rounded-t-lg'],
  ['hover:text-[#E8F0FE]', 'hover:text-slate-800'],
  ['h-[3px] bg-[#F59E0B]', 'h-[3px] bg-orange-500 rounded-t-lg shadow-[0_-2px_8px_rgba(249,115,22,0.4)]']
];

for (const [search, replace] of replacements) {
  content = content.split(search).join(replace);
}

// Ensure the map container isn't messed up by dark mode classes
content = content.replace(/className=\"z-0\"/g, 'className="z-0 rounded-xl overflow-hidden border border-orange-200 shadow-sm"');

fs.writeFileSync(path, content);
console.log('Manager Dashboard Orange Theme complete');
