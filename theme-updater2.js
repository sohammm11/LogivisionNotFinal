const fs = require('fs');
const path = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/manager/ManagerDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Fix buttons that should keep white text
content = content.replace(/text-slate-800 font-bold/g, 'text-white font-bold'); // Most buttons have font-bold
content = content.replace(/text-slate-800/g, 'text-slate-800'); // No-op, just reference

// Fix text-white explicitly inside buttons
content = content.replace(/bg-red-500 text-slate-800/g, 'bg-red-500 text-white');
content = content.replace(/bg-green-500 text-slate-800/g, 'bg-green-500 text-white');
content = content.replace(/bg-\[\#F59E0B\] text-slate-800/g, 'bg-[#F59E0B] text-white');
content = content.replace(/bg-[#0DD9B0] text-slate-800/g, 'bg-[#0DD9B0] text-white');

// Let's add better glassmorphism properties
// For the main table header
content = content.replace(/bg-slate-50\/50/g, 'bg-slate-100');

fs.writeFileSync(path, content);
console.log('Script 2 completed');
