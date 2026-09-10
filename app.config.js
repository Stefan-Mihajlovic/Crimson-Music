// Keep personal signing settings out of source control. Expo supplies app.json
// as `config`; these optional build-time values support contributor builds.
module.exports = ({ config }) => {
  const appleTeamId = process.env.IOS_APPLE_TEAM_ID?.trim();
  const bundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER?.trim();
  const androidPackage = process.env.ANDROID_PACKAGE?.trim();

  return {
    ...config,
    ios: {
      ...config.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
      ...(bundleIdentifier ? { bundleIdentifier } : {}),
    },
    android: {
      ...config.android,
      ...(androidPackage ? { package: androidPackage } : {}),
    },
  };
};
