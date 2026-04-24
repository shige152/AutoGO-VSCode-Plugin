const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const files = [
  'README.md',
  'package.json',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LICENSE',
  '.editorconfig',
];

const decoder = new TextDecoder('utf-8', { fatal: true });
let hasError = false;

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`缺少文件: ${relativePath}`);
    hasError = true;
    continue;
  }

  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    console.error(`检测到 BOM: ${relativePath}`);
    hasError = true;
    continue;
  }

  try {
    decoder.decode(buffer);
  } catch (error) {
    console.error(`UTF-8 解码失败: ${relativePath}`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

console.log('UTF-8 检查通过。');
