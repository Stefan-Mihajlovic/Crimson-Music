/* global __dirname */
const { withAndroidManifest, withAppBuildGradle, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
module.exports = function withCrimsonFolding(config) {
  config = withAndroidManifest(config, (mod) => {
    const activity = mod.modResults.manifest.application[0].activity.find((item) => item.$['android:name'] === '.MainActivity');
    if (activity) activity.$['android:resizeableActivity'] = 'true';
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    const dependency = 'implementation("androidx.window:window:1.5.1")';
    if (!mod.modResults.contents.includes(dependency)) {
      if (!mod.modResults.contents.includes('dependencies {')) throw new Error('Crimson folding: missing Gradle dependencies block.');
      mod.modResults.contents = mod.modResults.contents.replace('dependencies {', `dependencies {\n    ${dependency}`);
    }
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    const registration = 'add(CrimsonFoldingPackage())';
    const anchor = 'PackageList(this).packages.apply {';
    if (!mod.modResults.contents.includes(registration)) {
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Crimson folding: review package registration.');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${anchor}\n          ${registration}`);
    }
    return mod;
  });
  return withDangerousMod(config, ['android', (mod) => {
    const destination = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java', ...mod.android.package.split('.'));
    fs.mkdirSync(destination, { recursive: true });
    for (const file of ['CrimsonFoldingModule.kt', 'CrimsonFoldingPackage.kt']) {
      fs.writeFileSync(path.join(destination, file), fs.readFileSync(path.join(__dirname, 'crimson-folding', file), 'utf8').replace('package com.crimson.folding', `package ${mod.android.package}`));
    }
    return mod;
  }]);
};
