const fs = require('fs');
const path = require('path');
const testDir = 'test';
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
let total = 0;
files.forEach(f => {
  const fp = path.join(testDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  // Replace .revert(ethers) with .reverted
  const newContent = content.replace(/\.to\.revert\(ethers\)/g, '.to.be.reverted');
  const newContent2 = newContent.replace(/\.to\.not\.revert\(ethers\)/g, '.to.not.be.reverted');
  // Also handle .revert (with spaces)
  const newContent3 = newContent2.replace(/\.revert\(ethers\)/g, '.be.reverted');
  // Fix .revert\s*\(\s*ethers\s*\)
  const newContent4 = newContent3.replace(/\.revert\(\s*ethers\s*\)/g, '.be.reverted');
  // Fix standalone .revert\(\)
  const newContent5 = newContent4.replace(/\.revert\(\)/g, '.reverted');
  
  if (newContent5 !== content) {
    fs.writeFileSync(fp, newContent5);
    console.log('Fixed .revert calls in:', f);
    total++;
  }
});
console.log('Total files fixed:', total);
