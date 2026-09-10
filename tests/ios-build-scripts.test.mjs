import assert from 'node:assert/strict';
import { test } from 'node:test';
import helpers from '../scripts/lib/ios-build-scripts.cjs';
const { fixSceneStartup, fixSceneDelegate, fixSentryBuildScript } = helpers;

test('scene migration preserves native module initialization and is idempotent', () => {
  const source = `    reactNativeDelegate = delegate
    reactNativeFactory = factory
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    CustomNativeModule.configure()
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;
  const fixed = fixSceneStartup(source);
  assert.ok(fixed.includes('initialLaunchOptions = launchOptions'));
  assert.ok(fixed.includes('CustomNativeModule.configure()'));
  assert.ok(!fixed.includes('factory.startReactNative'));
  assert.equal(fixSceneStartup(fixed), fixed);
});
test('unknown scene startup formats fail instead of silently corrupting generated native code', () => {
  assert.throws(() => fixSceneStartup('changed template'), /startup block/);
});
test('new scene forwards cold URLs before React starts and warm URLs through the existing app delegate', () => {
  const source = 'class AppDelegate { /* existing Linking API */ }\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {\n}\n';
  const fixed = fixSceneDelegate(source);
  assert.ok(fixed.includes('launchOptions[.url] = context.url'));
  assert.ok(fixed.indexOf('forwardURLContext(context, to: appDelegate)') < fixed.indexOf('factory.startReactNative'));
  assert.ok(fixed.includes('launchOptions: launchOptions.isEmpty ? nil : launchOptions)'));
  assert.ok(fixed.includes('openURLContexts URLContexts: Set<UIOpenURLContext>'));
  assert.ok(fixed.includes('appDelegate.application(UIApplication.shared, open: context.url, options: options)'));
  assert.ok(fixed.includes('class AppDelegate { /* existing Linking API */ }'));
  assert.equal(fixSceneDelegate(fixed), fixed);
});
test('existing generated scene is upgraded instead of silently skipping URL forwarding', () => {
  const legacy = `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.initialLaunchOptions)
  }
}`;
  const fixed = fixSceneDelegate(legacy);
  assert.ok(fixed.includes('openURLContexts URLContexts: Set<UIOpenURLContext>'));
  assert.equal(fixed.match(/class SceneDelegate:/g).length, 1);
  assert.equal(fixSceneDelegate(fixed), fixed);
});
test('scene URL migration refuses unknown or duplicate native templates', () => {
  assert.throws(() => fixSceneDelegate('class SceneDelegate: CustomSceneDelegate {}'), /Unrecognized SceneDelegate/);
  assert.throws(() => fixSceneDelegate('class SceneDelegate: One {}\nclass SceneDelegate: Two {}'), /Multiple SceneDelegate/);
  assert.throws(() => fixSceneDelegate('changed template'), /ReactNativeDelegate/);
});
test('Sentry wrapper quotes script paths and optional upload branch is idempotent', () => {
  const fixed = fixSentryBuildScript('export NODE_BINARY=node\n/bin/sh `resolve-sentry-xcode.sh`');
  assert.ok(fixed.includes('/bin/sh "$REACT_NATIVE_XCODE_SCRIPT"'));
  assert.ok(fixed.includes('SENTRY_DISABLE_AUTO_UPLOAD'));
  assert.equal(fixSentryBuildScript(fixed), fixed);
  const symbols = fixSentryBuildScript('sentry-xcode-debug-files.sh');
  assert.ok(symbols.includes('/bin/sh "$SENTRY_DEBUG_SCRIPT"'));
  assert.equal(fixSentryBuildScript(symbols), symbols);
});
