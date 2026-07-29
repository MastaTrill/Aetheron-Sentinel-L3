import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEPRECATED_PREFIX = 'sentinel-l3-v1.0/';
const RETIREMENT_MARKER = 'sentinel-l3-v1.0/README_DEPRECATED.md';
const RELEASE_CORE = new Set(['SentinelInterceptor', 'CircuitBreaker', 'RateLimiter']);
const errors = [];

const activeRoots = ['.github/workflows', 'scripts', 'script', 'config', 'site', 'docs'];
const allowedExtensions = new Set(['.yml', '.yaml', '.json', '.js', '.cjs', '.mjs', '.ts', '.md', '.sol']);
const allowDeprecatedReferences = new Set([
  RETIREMENT_MARKER,
  'PROJECT_STATUS.md',
  '.github/workflows/canonical-release-scope.yml',
  'scripts/validate-canonical-release-scope.mjs',
  'docs/OPERATIONAL_ACTIONS_REQUIRED.md',
  'docs/decisions/ADR-2026-07-29-SENTINEL-BENEFICIARY-REDEPLOYMENT.md',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (allowedExtensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

for (const root of activeRoots) {
  for (const file of walk(path.join(ROOT, root))) {
    const relative = path.relative(ROOT, file).replaceAll('\\', '/');
    if (relative.startsWith(DEPRECATED_PREFIX) || allowDeprecatedReferences.has(relative)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(DEPRECATED_PREFIX)) {
      errors.push(`active file references retired tree: ${relative}`);
    }
  }
}

const retirementPath = path.join(ROOT, RETIREMENT_MARKER);
if (!fs.existsSync(retirementPath)) {
  errors.push(`${RETIREMENT_MARKER} is required while the retired tree exists`);
} else {
  const retirement = fs.readFileSync(retirementPath, 'utf8');
  if (!retirement.includes('Status: RETIRED')) {
    errors.push(`${RETIREMENT_MARKER} must contain the permanent RETIRED status marker`);
  }
  if (!/archive-only, permanently non-canonical/i.test(retirement)) {
    errors.push(`${RETIREMENT_MARKER} must identify the tree as archive-only and permanently non-canonical`);
  }
}

const scopePath = path.join(ROOT, 'PROJECT_STATUS.md');
if (!fs.existsSync(scopePath)) {
  errors.push('PROJECT_STATUS.md is required');
} else {
  const scope = fs.readFileSync(scopePath, 'utf8');
  for (const contract of RELEASE_CORE) {
    if (!scope.includes(contract)) errors.push(`release scope omits ${contract}`);
  }
  if (!/Base Mainnet[^\n]*(Pending|not deployed)/i.test(scope)) {
    errors.push('PROJECT_STATUS.md must state that Base mainnet Sentinel deployment is pending/not deployed');
  }
}

for (const fileName of ['DEPLOYMENT_COMPLETE_SUMMARY_MAINNET.md', 'RELEASE_NOTES_MAINNET_2026-04-27.md']) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, 'utf8');
  if (!/(historical|not executed|unexecuted|no mainnet deployment)/i.test(text)) {
    errors.push(`${fileName} must be explicitly marked historical and unexecuted`);
  }
}

if (errors.length) {
  console.error('Canonical Sentinel release validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Canonical Sentinel release scope validation passed.');
