const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = path.join(__dirname, '..', 'out', 'test', 'unit');

if (!fs.existsSync(testDir)) {
  console.error(`Test directory not found: ${testDir}`);
  process.exit(1);
}

const testFiles = fs
  .readdirSync(testDir)
  .filter((file) => file.endsWith('.js'))
  .sort()
  .map((file) => path.join(testDir, file));

if (testFiles.length === 0) {
  console.error(`No test files found in: ${testDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
