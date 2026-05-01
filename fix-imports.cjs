const fs = require('fs');
const path = require('path');
const testDir = 'test';
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
files.forEach(f => {
  const fp = path.join(testDir, f);
  let content = fs.readFileSync(fp, 'utf8');
  // Remove any standalone import { network } lines
  content = content.replace(/import \{ network \} from 'hardhat';\n?/g, '');
  content = content.replace(/import \{ network \} from "hardhat";\n?/g, '');
  // Replace import { ethers } from "hardhat" with the default import
  content = content.replace(/import \{\s*ethers\s*\} from 'hardhat';/, "import hardhat from 'hardhat';\nconst { ethers } = hardhat;");
  content = content.replace(/import \{\s*ethers\s*\} from "hardhat";/, "import hardhat from 'hardhat';\nconst { ethers } = hardhat;");
  // Also handle any const { ethers } = hardhat; already there (from prev fix)
  fs.writeFileSync(fp, content);
  console.log('Fixed:', f);
});
console.log('Done!');
