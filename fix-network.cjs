const fs = require('fs');
const path = require('path');
const testDir = 'test';
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
files.forEach(f => {
  const fp = path.join(testDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  let changed = false;
  // Check if file still has the pattern
  if (content.includes('await network.create()')) {
    // Remove any standalone import { network } lines
    content = content.replace(/import { network } from 'hardhat';\n?/g, '');
    content = content.replace(/import { network } from "hardhat";\n?/g, '');
    // Replace the const { ethers } = await network.create(); line
    const importLine = 'import hardhat from "hardhat";\nconst { ethers } = hardhat;';
    content = content.replace(/const { ethers } = await network\.create\(\);/g, importLine);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(fp, content);
    console.log('Fixed network.create in:', f);
  }
});
console.log('Done!');
