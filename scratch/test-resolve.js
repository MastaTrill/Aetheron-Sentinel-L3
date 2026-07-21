import { createRequire } from 'module';
const require = createRequire(import.meta.url);
console.log('Resolved Hardhat path:', require.resolve('hardhat'));
console.log('cwd:', process.cwd());
