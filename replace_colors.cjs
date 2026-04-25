const fs = require('fs');
const file = 'components/DashboardView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/green:\s*'#006B3F'/g, "green:    '#6b21a8'");
content = content.replace(/greenMid:\s*'#008f55'/g, "greenMid: '#9333ea'");
content = content.replace(/greenLt:\s*'#00c471'/g, "greenLt:  '#a855f7'");
content = content.replace(/greenDim:\s*'#003d24'/g, "greenDim: '#3b0764'");

content = content.replace(/grid:\s*'#1a2e23'/g, "grid:     '#2e1a2b'");
content = content.replace(/gridLt:\s*'#243b2e'/g, "gridLt:   '#3b2438'");
content = content.replace(/text:\s*'#a3c4b0'/g, "text:     '#c4a3be'");
content = content.replace(/textDim:\s*'#4d7260'/g, "textDim:  '#724d67'");

content = content.replace(/#4ade80/g, '#c084fc');
content = content.replace(/#0d1a12/g, '#180a1f');
content = content.replace(/#0a1610/g, '#14081c');
content = content.replace(/rgba\(0,107,63/g, 'rgba(107,33,168');
content = content.replace(/rgba\(0,196,113/g, 'rgba(168,85,247');

fs.writeFileSync(file, content);
console.log("Colors replaced successfully.");
