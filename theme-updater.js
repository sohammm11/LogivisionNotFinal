const fs = require('fs');
const path = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/manager/ManagerDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Colors
content = content.replace(/bg-\[#080C14\]/g, 'bg-slate-50');
content = content.replace(/bg-\[#0D1421\]/g, 'bg-white/90 backdrop-blur-md shadow-sm');
content = content.replace(/bg-\[#111827\]/g, 'bg-white');
content = content.replace(/text-\[#E8F0FE\]/g, 'text-slate-800');
content = content.replace(/text-\[#6B7FA8\]/g, 'text-slate-500');
content = content.replace(/border-\[#1E2D45\]/g, 'border-slate-200');
content = content.replace(/border-white\/10/g, 'border-slate-200');
content = content.replace(/border-white\/30/g, 'border-slate-300');
content = content.replace(/text-white\/60/g, 'text-slate-500');
content = content.replace(/text-white\/80/g, 'text-slate-600');
content = content.replace(/text-white/g, 'text-slate-800'); // Be careful, might break buttons with white text on dark bg. Let's fix specific ones later
content = content.replace(/bg-white\/10/g, 'bg-slate-50');
content = content.replace(/bg-black\/50/g, 'bg-slate-900/40 backdrop-blur-sm');

// Animations & Shadows
content = content.replace(/rounded-md p-5/g, 'rounded-xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1');
content = content.replace(/hover:bg-\[#1E2D4550\] transition-colors/g, 'hover:bg-slate-50 transition-all duration-200 hover:shadow-sm');
content = content.replace(/bg-[#0DD9B015]/g, 'bg-teal-50');

// Fix specific buttons that should keep white text
content = content.replace(/bg-\[#528FF0\] text-slate-800/g, 'bg-[#528FF0] text-white');
content = content.replace(/bg-\[#10B981\] text-slate-800/g, 'bg-[#10B981] text-white');

fs.writeFileSync(path, content);
console.log('Script completed');
