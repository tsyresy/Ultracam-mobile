const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-zeroconf',
  'android',
  'build.gradle'
);

if (!fs.existsSync(file)) {
  console.log('[patch-zeroconf] module absent, rien a faire');
  process.exit(0);
}

const source = fs.readFileSync(file, 'utf8');
const patched = source.replace(
  /^[ \t]*buildToolsVersion[ \t]+["'][^"']+["'][ \t]*\r?\n/m,
  ''
);

if (patched === source) {
  console.log('[patch-zeroconf] deja corrige (aucun buildToolsVersion fige)');
} else {
  fs.writeFileSync(file, patched);
  console.log('[patch-zeroconf] buildToolsVersion fige supprime');
}
