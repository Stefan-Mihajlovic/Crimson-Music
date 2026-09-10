function fixSentryBuildScript(script) {
  const resolveScript = (name) => `$("$NODE_BINARY" --print "require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/${name}'")`;
  const optionalUpload = 'if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then export SENTRY_DISABLE_AUTO_UPLOAD=true; fi';
  if (script.includes('sentry-xcode-debug-files.sh')) {
    return `NODE_BINARY="\${NODE_BINARY:-node}"\n${optionalUpload}\nSENTRY_DEBUG_SCRIPT="${resolveScript('sentry-xcode-debug-files.sh')}"\n/bin/sh "$SENTRY_DEBUG_SCRIPT"\n`;
  }
  if (!script.includes('sentry-xcode.sh')) return script;
  const runner = '# Crimson quoted Sentry runner\nif [ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" = true ]; then\n  /bin/sh "$REACT_NATIVE_XCODE_SCRIPT"\nelse\n  /bin/sh "$SENTRY_XCODE_SCRIPT" "$REACT_NATIVE_XCODE_SCRIPT"\nfi\n';
  if (script.includes('# Crimson quoted Sentry runner')) return script;
  if (script.includes('SENTRY_XCODE_SCRIPT=')) return script.replace('/bin/sh "$SENTRY_XCODE_SCRIPT" "$REACT_NATIVE_XCODE_SCRIPT"\n', runner);
  const start = script.indexOf('/bin/sh `');
  if (start < 0) throw new Error('Unrecognized Sentry bundle script.');
  return script.slice(0, start)
    + `${optionalUpload}\nSENTRY_XCODE_SCRIPT="${resolveScript('sentry-xcode.sh')}"\n`
    + 'REACT_NATIVE_XCODE_SCRIPT="$("$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'")"\n'
    + runner;
}

function fixSceneStartup(source) {
  if (source.includes('    initialLaunchOptions = launchOptions')) return source;
  // Preserve config-plugin initialization between UIWindow and React startup.
  const startup = /    window = UIWindow\(frame: UIScreen\.main\.bounds\)\n([\s\S]*?)    factory\.startReactNative\(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions\)/;
  if (!startup.test(source) || !source.includes('    reactNativeFactory = factory')) {
    throw new Error('[Expo iOS path fix] Expected AppDelegate startup block was not found.');
  }
  return source.replace(startup, '$1').replace('    reactNativeFactory = factory', '    reactNativeFactory = factory\n    initialLaunchOptions = launchOptions');
}

const legacySceneDelegate = `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
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

const sceneDelegate = legacySceneDelegate
  .replace('    let window = UIWindow(windowScene: windowScene)', `    // Scene launches carry their URL here, not in didFinishLaunching's options.
    var launchOptions = appDelegate.initialLaunchOptions ?? [:]
    if let context = connectionOptions.urlContexts.first {
      launchOptions[.url] = context.url
      launchOptions[.sourceApplication] = context.options.sourceApplication
      launchOptions[.annotation] = context.options.annotation
      // Prime Expo Linking before JS starts; launchOptions also serves RN Linking.
      forwardURLContext(context, to: appDelegate)
    }

    let window = UIWindow(windowScene: windowScene)`)
  .replace('launchOptions: appDelegate.initialLaunchOptions)', 'launchOptions: launchOptions.isEmpty ? nil : launchOptions)')
  .replace(/\n}$/, `

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      forwardURLContext(context, to: appDelegate)
    }
  }

  private func forwardURLContext(_ context: UIOpenURLContext, to appDelegate: AppDelegate) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace
    ]
    options[.sourceApplication] = context.options.sourceApplication
    options[.annotation] = context.options.annotation
    _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
  }
}`);

function fixSceneDelegate(source) {
  const declarations = source.match(/\bclass SceneDelegate\s*:/g) || [];
  if (declarations.length > 1) throw new Error('[Expo iOS path fix] Multiple SceneDelegate declarations were found.');
  if (source.includes(sceneDelegate)) return source;
  if (source.includes(legacySceneDelegate)) return source.replace(legacySceneDelegate, sceneDelegate);
  if (declarations.length) throw new Error('[Expo iOS path fix] Unrecognized SceneDelegate template; refusing to replace custom native code.');
  const anchor = 'class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {';
  if (!source.includes(anchor)) throw new Error('[Expo iOS path fix] Expected ReactNativeDelegate declaration was not found.');
  return source.replace(anchor, `${sceneDelegate}\n\n${anchor}`);
}

module.exports = { fixSentryBuildScript, fixSceneStartup, fixSceneDelegate };
