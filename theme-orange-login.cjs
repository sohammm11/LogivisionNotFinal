const fs = require('fs');
const path = 'D:/HO/Logivisionai (3)/Logivisionai/src/pages/Login.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
  ['bg-[#080C14]', 'bg-orange-50/30'],
  ['bg-[#0D1421]', 'bg-white shadow-2xl border-l border-orange-100'],
  ['bg-[#111827]', 'bg-white'],
  ['text-[#E8F0FE]', 'text-slate-800'],
  ['text-[#6B7FA8]', 'text-slate-500'],
  ['border-[#1E2D45]', 'border-orange-200'],
  ['text-[#F59E0B]', 'text-orange-600'],
  ['bg-[#F59E0B]', 'bg-orange-500 text-white'],
  ['border-l-[#F59E0B]', 'border-l-orange-500'],
  ['text-[#0DD9B0]', 'text-orange-500'], // change the green stats to orange too for consistency
  ['text-[#3D4F6B]', 'text-slate-400'],
  
  // Custom CSS replacements for grid and glow
  ['#1E2D45', 'rgba(249,115,22,0.1)'], // grid lines from dark blue to light orange
  ['rgba(245,158,11,0.08)', 'rgba(249,115,22,0.15)'], // glow blob slightly more visible but orange
  ['rgba(245,158,11,0.12)', 'rgba(249,115,22,0.2)'], // logo shadow
  ['rgba(245,158,11,0.3)', 'rgba(249,115,22,0.4)'], // button hover shadow
  
  // Input fields need slightly different background in light mode so they aren't completely white on white
  ['bg-[#111827] border', 'bg-orange-50/50 border']
];

for (const [search, replace] of replacements) {
  content = content.split(search).join(replace);
}

// Fix role chips styling strings since it uses dynamic template literals
// 'background: isActive ? ${role.color}20 : '#111827''
content = content.replace(/'#111827'/g, "'#ffffff'");
content = content.replace(/'#1E2D45'/g, "'#fed7aa'"); // orange-200 hex
content = content.replace(/'#6B7FA8'/g, "'#64748b'"); // slate-500 hex

fs.writeFileSync(path, content);
console.log('Login Theme Orange complete');
