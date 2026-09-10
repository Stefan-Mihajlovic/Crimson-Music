const { IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NATIVE_SOURCE_DIRECTORY = path.join(__dirname, 'crimson-remote-controls');

/**
 * Adds the iOS MediaPlayer commands that expo-audio does not currently expose:
 * previous track, next track, and like.
 */
module.exports = function withCrimsonRemoteControls(config) {
  for (const filePath of ['CrimsonRemoteControls.swift', 'CrimsonRemoteControlsBridge.m']) {
    config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
      filePath,
      contents: fs.readFileSync(path.join(NATIVE_SOURCE_DIRECTORY, filePath), 'utf8'),
      overwrite: true,
    });
  }

  return config;
};
