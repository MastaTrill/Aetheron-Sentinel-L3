const fs = require('fs');
const path = require('path');
const testDir = 'test';
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
files.forEach(f => {
  const fp = path.join(testDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/import \{ network \} from 'hardhat';/, '');
  content = content.replace(/import \{ network \} from "hardhat";/, '');
  const lines = content.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/const \{\+? ?ethers\s*\}= await network.create\(\);/)) {
      result.push('import { ethers } from "hardhat";');
    } else {
      result.push(lines[i]);
    }
  }
  fs.writeFileSync(fp, result.join('\n'));
  console.log('Fixed:', f);
});
console.log('Done!');
