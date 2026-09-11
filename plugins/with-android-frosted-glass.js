/* global __dirname */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const marker = '// Crimson shared Android blur v3';
function patchAndroidBlur(projectRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  if (!config.expo?.autolinking?.android?.buildFromSource?.includes('expo-blur')) {
    throw new Error('Crimson frosted glass requires expo-blur in expo.autolinking.android.buildFromSource.');
  }
  const packagePath = require.resolve('expo-blur/package.json', { paths: [projectRoot] });
  const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
  if (version !== '57.0.3') throw new Error(`Review the Crimson blur adapter before upgrading expo-blur ${version}.`);
  const sourceRoot = path.join(path.dirname(packagePath), 'android/src/main/java/expo/modules/blur');
  const file = path.join(sourceRoot, 'ExpoBlurView.kt');
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(marker)) {
    const original = '  private val blurView = BlurView(context).also {';
    if (!source.includes(original) || !source.includes('blurView.setupWith(dimezisBlurTarget)')) {
      throw new Error('Expo blur setup changed; review the Crimson blur adapter.');
    }
    source = source.replace(original, `  ${marker}
  private val blurView = (if (Build.VERSION.SDK_INT < 31) CrimsonLegacyBlurView(context) else BlurView(context)).also {`);
    // Pre-31 shares one snapshot per target; newer Android keeps RenderNode.
    source = source.replace('blurView.setupWith(dimezisBlurTarget)', 'blurView.setupWith(dimezisBlurTarget, null, 6f, false)');
    source = source.replace('blurView.setOverlayColor(tint.toBlurEffect(blurRadius))', 'blurView.setOverlayColor(Color.TRANSPARENT)');
    fs.writeFileSync(file, source);
  }
  for (const name of ['CrimsonRenderScriptBlur.kt', 'CrimsonLegacyBlurView.kt']) {
    fs.copyFileSync(path.join(__dirname, 'crimson-android-blur', name), path.join(sourceRoot, name));
  }
}
module.exports = function withAndroidFrostedGlass(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    patchAndroidBlur(mod.modRequest.projectRoot);
    return mod;
  }]);
};
module.exports.patchAndroidBlur = patchAndroidBlur;
