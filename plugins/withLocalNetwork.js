const { withAndroidManifest, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');
module.exports = config => {
 config = withAndroidManifest(config, config => {
  config.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
  return config;
 });
 config = withAppBuildGradle(config, config => {
  let source = config.modResults.contents;
  if (process.env.EAS_BUILD !== 'true' && !source.includes('signing/release.properties')) {
   source = source.replace('    signingConfigs {', `    signingConfigs {
        release {
            def credentials = new Properties()
            credentials.load(new FileInputStream(rootProject.file("../signing/release.properties")))
            storeFile rootProject.file("../signing/ultracam-release.p12")
            storePassword credentials["storePassword"]
            keyPassword credentials["keyPassword"]
            keyAlias credentials["keyAlias"]
        }`);
   source = source.replace(/(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  }
  config.modResults.contents = source;
  return config;
 });
 return withGradleProperties(config, config => {
  const values = {'android.targetSdkVersion':'35','android.kotlinVersion':'1.9.24','org.gradle.workers.max':'2','reactNativeArchitectures':'arm64-v8a,armeabi-v7a','expo.gif.enabled':'false','expo.webp.enabled':'false','expo.webp.animated':'false'};
  for (const [key,value] of Object.entries(values)) {
   config.modResults = config.modResults.filter(item => item.key !== key);
   config.modResults.push({type:'property',key,value});
  }
  return config;
 });
};
