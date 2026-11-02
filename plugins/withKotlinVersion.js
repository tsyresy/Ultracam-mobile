const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const KOTLIN_VERSION = '1.9.25';

const CATALOG = 'gradle/libs.versions.toml';

const KOTLIN_ENTRY = /^kotlin\s*=\s*".*"\s*$/m;

function packageRoot(packageName, fromDir) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`, { paths: [fromDir] }));
  } catch {
    const direct = path.join(fromDir, 'node_modules', packageName);
    return fs.existsSync(direct) ? direct : null;
  }
}

function patchCatalog(packageName, fromDir) {
  const root = packageRoot(packageName, fromDir);
  if (!root) {
    throw new Error(`[withKotlinVersion] cannot resolve ${packageName} from ${fromDir}`);
  }
  const filePath = path.join(root, CATALOG);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[withKotlinVersion] missing ${filePath}`);
  }
  const contents = fs.readFileSync(filePath, 'utf8');
  const match = contents.match(KOTLIN_ENTRY);
  if (!match) {
    throw new Error(`[withKotlinVersion] no kotlin entry in ${filePath}`);
  }
  if (match[0].trim() !== `kotlin = "${KOTLIN_VERSION}"`) {
    fs.writeFileSync(filePath, contents.replace(KOTLIN_ENTRY, `kotlin = "${KOTLIN_VERSION}"`));
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
      const reactNativeRoot = packageRoot('react-native', projectRoot);
      if (!reactNativeRoot) {
        throw new Error(`[withKotlinVersion] cannot resolve react-native from ${projectRoot}`);
      }
      patchCatalog('@react-native/gradle-plugin', reactNativeRoot);
      patchCatalog('react-native', projectRoot);
      return config;
    },
  ]);
};
