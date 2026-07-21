const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MVP_DIR = path.join(__dirname, '..');

function collectJsFiles(dir) {
  var results = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    var fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results = results.concat(collectJsFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = collectJsFiles(MVP_DIR);
let hasError = false;

files.forEach(function (file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('OK   ' + path.relative(MVP_DIR, file));
  } catch (err) {
    hasError = true;
    console.error('FAIL ' + path.relative(MVP_DIR, file));
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
});

if (hasError) {
  process.exit(1);
}

console.log('\nSyntax check passed for ' + files.length + ' file(s).');
