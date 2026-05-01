const fs = require('fs');
const path = require('path');
const testDir = 'test';
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
let count = 0;
files.forEach(f => {
  const fp = path.join(testDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  const org = content;
  content = content.replace(/\\.to\\.not\\.revert\\(ethers\\)/g, '.to.not.be.reverted');
  content = content.replace(/\\.to\\.revert\\(ethers\\)/g, '.to.be.reverted');
  content = content.replace(/\\.revert\\(ethers\\)/g, '.be.reverted');
  if (content !== org) {
    fs.writeFileSync(fp, content);
    console.log('Fixed:', f);
    count++;
  }
});
console.log('Total:', count);
