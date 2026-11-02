const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const KOTLIN_VERSION = '1.9.25';

const CATALOGS = [
  ['node_modules/@react-native/gradle-plugin', 'gradle/libs.versions.toml'],
  ['node_modules/react-native', 'gradle/libs.versions.toml'],
];

const KOTLIN_ENTRY = /^kotlin\s*=\s*".*"\s*$/gm;

function patchCatalog(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  KOTLIN_ENTRY.lastIndex = 0;
  if (!KOTLIN_ENTRY.test(contents)) {
    throw new Error(`[withKotlinVersion] no kotlin entry in ${filePath}`);
  }
  const patched = contents.replace(KOTLIN_ENTRY, `kotlin = "${KOTLIN_VERSION}"`);
  if (patched !== contents) {
    fs.writeFileSync(filePath, patched);
  }
}

module.exports = function withKotlinVersion(config) {
  config = withGradleProperties(config, (config) => {
    const properties = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'android.kotlinVersion')
    );
    properties.push({ type: 'property', key: 'android.kotlinVersion', value: KOTLIN_VERSION });
    config.modResults = properties;
    return config;
  });

  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      for (const [packageName, relativePath] of CATALOGS) {
        const packageRoot = path.join(projectRoot, 'node_modules', packageName);
        const filePath = path.join(packageRoot, relativePath);
        if (!fs.existsSync(filePath)) {
          throw new Error(`[withKotlinVersion] missing ${packageName}/${relativePath}`);
        }
        patchCatalog(filePath);
      }
      return config;
    },
  ]);
};
