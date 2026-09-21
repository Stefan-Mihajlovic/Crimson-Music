/* global __dirname */
const { IOSConfig, withAndroidManifest, withDangerousMod, withInfoPlist, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const sourceDirectory = path.join(__dirname, 'crimson-local-music');
module.exports = function withLocalMusic(config) {
  for (const filePath of ['CrimsonLocalMusic.swift', 'CrimsonLocalMusicBridge.m']) {
    config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
      filePath, contents: fs.readFileSync(path.join(sourceDirectory, filePath), 'utf8'), overwrite: true,
    });
  }
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSAppleMusicUsageDescription = 'Allow Crimson to find downloaded, unprotected audio in your music library.';
    mod.modResults.UIFileSharingEnabled = true;
    mod.modResults.LSSupportsOpeningDocumentsInPlace = true;
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const permissions = mod.modResults.manifest['uses-permission'] || [];
    for (const [name, max] of [['android.permission.READ_MEDIA_AUDIO'], ['android.permission.READ_EXTERNAL_STORAGE', '32']]) {
      if (!permissions.some((permission) => permission.$['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name, ...(max ? { 'android:maxSdkVersion': max } : {}) } });
      }
    }
    mod.modResults.manifest['uses-permission'] = permissions;
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes('add(CrimsonLocalMusicPackage())')) {
      const anchor = 'PackageList(this).packages.apply {';
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Crimson Local Music: review MainApplication package registration.');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${anchor}\n              add(CrimsonLocalMusicPackage())`);
    }
    return mod;
  });
  return withDangerousMod(config, ['android', (mod) => {
    const packageName = mod.android.package;
    const destination = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
    fs.mkdirSync(destination, { recursive: true });
    for (const filename of ['CrimsonLocalMusicModule.kt', 'CrimsonLocalMusicPackage.kt']) {
      fs.writeFileSync(path.join(destination, filename), fs.readFileSync(path.join(sourceDirectory, filename), 'utf8').replace('package com.crimson.localmusic', `package ${packageName}`));
    }
    return mod;
  }]);
};
