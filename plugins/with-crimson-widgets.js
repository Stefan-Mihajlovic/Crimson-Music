/* global __dirname */
const { AndroidConfig, IOSConfig, withAndroidManifest, withDangerousMod, withEntitlementsPlist, withMainApplication, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist');
const { writeAndroidResources } = require('./crimson-widgets/android-resources');

const sources = path.join(__dirname, 'crimson-widgets');
const brandLogo = path.join(__dirname, '../assets/images/icon.png');
const extensionName = 'CrimsonWidgets';
const unquote = (value) => typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;

function installIOSExtension(project, nativeRoot, { bundleIdentifier, appGroup, appleTeamId }) {
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ||= {};
  objects.PBXContainerItemProxy ||= {};
  const main = project.getFirstTarget();
  let targetId = Object.keys(objects.PBXNativeTarget).find((key) => unquote(objects.PBXNativeTarget[key]?.name) === extensionName);
  if (!targetId) {
    targetId = project.addTarget(extensionName, 'app_extension', extensionName, `${bundleIdentifier}.widgets`).uuid;
    project.addBuildPhase([`${extensionName}/CrimsonWidget.swift`], 'PBXSourcesBuildPhase', 'Sources', targetId);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetId);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetId);
    const group = project.addPbxGroup([`${extensionName}/CrimsonWidget.swift`, `${extensionName}/Info.plist`, `${extensionName}/${extensionName}.entitlements`], extensionName, '.');
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  }
  // Repair previously generated groups as well as fresh prebuilds.
  const extensionGroup = project.pbxGroupByName(extensionName);
  if (extensionGroup) extensionGroup.path = '.';
  const target = objects.PBXNativeTarget[targetId];
  const logoPath = `${extensionName}/crimson-logo.png`;
  if (!project.hasFile(logoPath)) {
    if (!project.pbxGroupByName('Resources')) {
      const resources = project.addPbxGroup([], 'Resources', '.');
      project.addToPbxGroup(resources.uuid, project.getFirstProject().firstProject.mainGroup);
    }
    const groupId = Object.keys(objects.PBXGroup).find((key) => unquote(objects.PBXGroup[key]?.name) === extensionName);
    project.addResourceFile(logoPath, { target: targetId }, groupId);
  }
  const configurations = objects.XCBuildConfiguration;
  const mainConfigurations = objects.XCConfigurationList[main.firstTarget.buildConfigurationList].buildConfigurations;
  for (const reference of objects.XCConfigurationList[target.buildConfigurationList].buildConfigurations) {
    const configuration = configurations[reference.value];
    const mainConfiguration = mainConfigurations.map((item) => configurations[item.value]).find((item) => item.name === configuration.name) || configurations[mainConfigurations[0].value];
    const settings = mainConfiguration.buildSettings;
    configuration.buildSettings = {
      ...configuration.buildSettings,
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      CLANG_ENABLE_MODULES: 'YES',
      CODE_SIGN_ENTITLEMENTS: `${extensionName}/${extensionName}.entitlements`,
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: settings.CURRENT_PROJECT_VERSION || '1',
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${extensionName}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: settings.IPHONEOS_DEPLOYMENT_TARGET || '16.4',
      MARKETING_VERSION: settings.MARKETING_VERSION || '1.0',
      PRODUCT_BUNDLE_IDENTIFIER: `${bundleIdentifier}.widgets`,
      SDKROOT: 'iphoneos',
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: settings.TARGETED_DEVICE_FAMILY || '"1,2"',
    };
    const team = appleTeamId || unquote(settings.DEVELOPMENT_TEAM);
    if (team) configuration.buildSettings.DEVELOPMENT_TEAM = team;
  }
  for (const uuid of [main.uuid, targetId]) {
    const previous = project.getFirstProject().firstProject.attributes.TargetAttributes?.[uuid]?.SystemCapabilities || {};
    project.addTargetAttribute('SystemCapabilities', { ...previous, 'com.apple.ApplicationGroups.iOS': { enabled: 1 } }, { uuid });
  }
  const directory = path.join(nativeRoot, extensionName);
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(brandLogo, path.join(directory, 'crimson-logo.png'));
  fs.writeFileSync(path.join(directory, 'CrimsonWidget.swift'), fs.readFileSync(path.join(sources, 'ios/CrimsonWidget.swift'), 'utf8').replaceAll('__APP_GROUP__', appGroup));
  fs.writeFileSync(path.join(directory, `${extensionName}.entitlements`), plist.default.build({ 'com.apple.security.application-groups': [appGroup] }));
  fs.writeFileSync(path.join(directory, 'Info.plist'), plist.default.build({
    CFBundleDisplayName: 'Crimson Music',
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    CFBundleName: '$(PRODUCT_NAME)',
    CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundlePackageType: 'XPC!',
    CFBundleShortVersionString: '$(MARKETING_VERSION)',
    CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
    NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
  }));
  return targetId;
}

function installAndroidSources(nativeRoot, packageName) {
  const directory = path.join(nativeRoot, 'app/src/main/java', ...packageName.split('.'), 'widgets');
  fs.mkdirSync(directory, { recursive: true });
  for (const file of ['CrimsonWidgetsModule.kt', 'CrimsonWidgetProvider.kt', 'CrimsonWidgetsPackage.kt']) {
    fs.writeFileSync(path.join(directory, file), fs.readFileSync(path.join(sources, 'android', file), 'utf8').replaceAll('__PACKAGE__', packageName));
  }
  writeAndroidResources(path.join(nativeRoot, 'app/src/main/res'));
  const drawables = path.join(nativeRoot, 'app/src/main/res/drawable-nodpi');
  fs.mkdirSync(drawables, { recursive: true });
  fs.copyFileSync(brandLogo, path.join(drawables, 'crimson_widget_logo.png'));
}

function patchMainApplication(contents, packageName) {
  const registration = `add(${packageName}.widgets.CrimsonWidgetsPackage())`;
  if (contents.includes(registration)) return contents;
  const anchor = 'PackageList(this).packages.apply {';
  if (!contents.includes(anchor)) throw new Error('Crimson widgets: MainApplication package registration changed; update the config plugin.');
  return contents.replace(anchor, `${anchor}\n          ${registration}`);
}

module.exports = function withCrimsonWidgets(config) {
  const bundleIdentifier = config.ios?.bundleIdentifier || 'com.stefanmihajlovic.crimsonmusic';
  const packageName = config.android?.package || bundleIdentifier;
  const appGroup = `group.${bundleIdentifier}`;
  for (const filePath of ['CrimsonWidgets.swift', 'CrimsonWidgetsBridge.m']) {
    config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
      filePath,
      contents: fs.readFileSync(path.join(sources, 'ios', filePath), 'utf8').replaceAll('__APP_GROUP__', appGroup),
      overwrite: true,
    });
  }
  config = withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] || [];
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...groups, appGroup])];
    return mod;
  });
  config = withXcodeProject(config, (mod) => {
    installIOSExtension(mod.modResults, mod.modRequest.platformProjectRoot, { bundleIdentifier, appGroup, appleTeamId: config.ios?.appleTeamId });
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = patchMainApplication(mod.modResults.contents, packageName);
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.receiver ||= [];
    for (const name of ['Small', 'Medium', 'Large']) {
      const className = `${packageName}.widgets.Crimson${name}Widget`;
      const widget = {
        $: { 'android:name': className, 'android:exported': 'false', 'android:label': `@string/crimson_widget_${name.toLowerCase()}` },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
        'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': `@xml/crimson_widget_${name.toLowerCase()}_info` } }],
      };
      const index = application.receiver.findIndex((item) => item.$['android:name'] === className);
      if (index < 0) application.receiver.push(widget);
      else application.receiver[index] = widget;
    }
    return mod;
  });
  return withDangerousMod(config, ['android', (mod) => {
    installAndroidSources(mod.modRequest.platformProjectRoot, packageName);
    return mod;
  }]);
};

module.exports.installIOSExtension = installIOSExtension;
module.exports.installAndroidSources = installAndroidSources;
module.exports.patchMainApplication = patchMainApplication;
