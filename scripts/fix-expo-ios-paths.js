/* global __dirname */
const fs = require('fs');
const path = require('path');
const { fixSentryBuildScript, fixSceneStartup, fixSceneDelegate } = require('./lib/ios-build-scripts.cjs');

const projectRoot = path.join(__dirname, '..');

function replaceOnce(filePath, brokenValue, fixedValue, label, { optional = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (optional) return;
    console.log(`[Expo iOS path fix] ${label} is not installed; nothing to patch.`);
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  if (contents.includes(fixedValue) || (label === 'React Native bundle script' && contents.includes('REACT_NATIVE_XCODE_SCRIPT='))) {
    console.log(`[Expo iOS path fix] ${label} already supports paths containing spaces.`);
    return;
  }

  if (!contents.includes(brokenValue)) {
    throw new Error(`[Expo iOS path fix] Expected ${label} build phase was not found.`);
  }

  fs.writeFileSync(filePath, contents.replace(brokenValue, fixedValue));
  console.log(`[Expo iOS path fix] Patched ${label}.`);
}

const constantsPodspec = path.join(
  projectRoot,
  'node_modules',
  'expo-constants',
  'ios',
  'EXConstants.podspec',
);
replaceOnce(
  constantsPodspec,
  ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",',
  ':script => "bash -l \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",',
  'Expo Constants',
);

const constantsScript = path.join(
  projectRoot,
  'node_modules',
  'expo-constants',
  'scripts',
  'get-app-config-ios.sh',
);
replaceOnce(
  constantsScript,
  'PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)',
  'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")',
  'Expo Constants project-root detection',
);

const xcodeProject = path.join(
  projectRoot,
  'ios',
  'CrimsonMusic.xcodeproj',
  'project.pbxproj',
);
replaceOnce(
  xcodeProject,
  '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`',
  'REACT_NATIVE_XCODE_SCRIPT=\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"\\n\\"$REACT_NATIVE_XCODE_SCRIPT\\"',
  'React Native bundle script',
  { optional: true },
);

if (fs.existsSync(xcodeProject)) {
  const xcode = require('xcode');
  const parsedProject = xcode.project(xcodeProject);
  parsedProject.parseSync();
  for (const phase of Object.values(parsedProject.hash.project.objects.PBXShellScriptBuildPhase || {})) {
    if (!phase || typeof phase !== 'object' || !phase.shellScript) continue;
    const script = JSON.parse(phase.shellScript);
    phase.shellScript = JSON.stringify(fixSentryBuildScript(script));
  }
  fs.writeFileSync(xcodeProject, parsedProject.writeSync());
  const project = fs.readFileSync(xcodeProject, 'utf8');
  const sandboxEnabled = 'ENABLE_USER_SCRIPT_SANDBOXING = YES;';
  const sandboxDisabled = 'ENABLE_USER_SCRIPT_SANDBOXING = NO;';

  if (project.includes(sandboxEnabled)) {
    fs.writeFileSync(xcodeProject, project.replaceAll(sandboxEnabled, sandboxDisabled));
    console.log('[Expo iOS path fix] Disabled Xcode user script sandboxing for Expo build phases.');
  } else if (project.includes(sandboxDisabled)) {
    console.log('[Expo iOS path fix] Xcode user script sandboxing is already configured.');
  }
}

const appDelegatePath = path.join(projectRoot, 'ios', 'CrimsonMusic', 'AppDelegate.swift');
if (fs.existsSync(appDelegatePath)) {
  let appDelegate = fs.readFileSync(appDelegatePath, 'utf8');
  if (!appDelegate.includes('var initialLaunchOptions:')) {
    appDelegate = appDelegate.replace(
      '  var window: UIWindow?\n',
      '  var window: UIWindow?\n  var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
    );
  }

  appDelegate = fixSceneStartup(appDelegate);

  appDelegate = fixSceneDelegate(appDelegate);

  fs.writeFileSync(appDelegatePath, appDelegate);
  console.log('[Expo iOS path fix] Configured the iOS 27 scene lifecycle.');
}
