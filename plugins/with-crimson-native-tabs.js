/* global __dirname */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');
const marker = '// Crimson iPhone tabs adapter v3';
const guard = '#if !TARGET_OS_TV && !TARGET_OS_VISION && __IPHONE_OS_VERSION_MAX_ALLOWED >= 270000';
const template = fs.readFileSync(path.join(__dirname, 'crimson-native-tabs/controller.mm.inc'), 'utf8');
function replace(source, anchor, value) {
  if (!source.includes(anchor)) throw new Error('Crimson native tabs: upstream source changed; review the adapter before building.');
  return source.replace(anchor, value);
}
function patchController(source) {
  source = replace(source, '- (instancetype)init\n', `${template}\n- (instancetype)init\n`);
  source = replace(source, '  RNSTabsNavigationStateUpdateRequest *_Nullable _pendingStateUpdate;', `  BOOL _crimsonUsesTabs;
  BOOL _crimsonUserTabSelection;
  RNSTabsNavigationStateUpdateRequest *_Nullable _pendingStateUpdate;`);
  source = replace(source, '  [self setViewControllers:_tabScreenControllers animated:[[self viewControllers] count] != 0];', `${guard}
  if ([self crimsonInstallTabsIfNeeded]) return;
#endif
  [self setViewControllers:_tabScreenControllers animated:[[self viewControllers] count] != 0];`);
  // Adapt only RN Screens' state bookkeeping. UIKit's getters/setters must
  // remain untouched while it installs and displays the initial selected tab.
  source = source.replaceAll('self.selectedViewController', '[self crimsonSelectedController]')
    .replaceAll('self.viewControllers', '[self crimsonInstalledControllers]')
    .replaceAll('[self viewControllers]', '[self crimsonInstalledControllers]');
  return replace(source, '[self setSelectedViewController:nextSelectedViewController];',
    '[self crimsonSelectController:nextSelectedViewController];');
}
function patchAppearance(source) {
  const sync = `${guard}
  if (@available(iOS 27.0, *)) {
    UITab *tab = tabScreenCtrl.tab;
    if (tab != nil) {
      tab.title = tabBarItem.title ?: @"";
      tab.image = tabBarItem.image;
      tab.selectedImage = tabBarItem.selectedImage;
      tab.badgeValue = tabBarItem.badgeValue;
      tab.accessibilityIdentifier = tabScreenCtrl.tabScreenComponentView.tabItemTestID;
      tab.accessibilityLabel = tabScreenCtrl.tabScreenComponentView.tabItemAccessibilityLabel;
    }
  }
#endif`;
  source = replace(source, '              withImageLoader:imageLoader];\n}', `              withImageLoader:imageLoader];
  ${marker}
${sync}
}`);
  return replace(source, '  // A layout pass is required because the image might be loaded asynchronously,', `${guard}
  if (@available(iOS 27.0, *)) {
    UITab *tab = screenView.controller.tab;
    if (isSelected) tab.selectedImage = image;
    else tab.image = image;
  }
#endif
  // A layout pass is required because the image might be loaded asynchronously,`);
}
function patchHost(source) {
  return replace(source, '  if (_bottomAccessoryWrapperView != nil && !_bottomAccessoryHidden) {', `  ${marker}
  if (UIDevice.currentDevice.userInterfaceIdiom == UIUserInterfaceIdiomPhone) {
    // UIKit composites the accessory glass in the tab bar, outside contentView.
    // Removing the public UITabAccessory clears both content and system glass.
    // The opening pan lives on the stable app host, so detaching is now safe.
    UITabAccessory *accessory = !_bottomAccessoryHidden && _bottomAccessoryWrapperView != nil
        ? [[UITabAccessory alloc] initWithContentView:_bottomAccessoryWrapperView] : nil;
    [_controller setBottomAccessory:accessory animated:NO];
    return;
  }
  if (_bottomAccessoryWrapperView != nil && !_bottomAccessoryHidden) {`);
}
function patchCrimsonNativeTabs(root) {
  const pkg = require.resolve('react-native-screens/package.json', { paths: [root] });
  const version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  if (version !== '4.26.2') throw new Error(`Review Crimson native tabs before upgrading react-native-screens from ${version}.`);
  const base = path.join(path.dirname(pkg), 'ios/tabs');
  for (const [file, transform] of [
    ['host/RNSTabBarController.mm', patchController],
    ['RNSTabBarAppearanceCoordinator.mm', patchAppearance],
    ['host/RNSTabsHostComponentView.mm', patchHost],
  ]) {
    const target = path.join(base, file);
    const source = fs.readFileSync(target, 'utf8');
    if (source.includes('// Crimson iPhone tabs adapter v1') || source.includes('// Crimson iPhone tabs adapter v2')) {
      throw new Error('Reinstall react-native-screens to update the Crimson tabs adapter from an earlier version.');
    }
    if (!source.includes(marker)) fs.writeFileSync(target, transform(source));
  }
}
module.exports = (config) => withDangerousMod(config, ['ios', (config) => {
  patchCrimsonNativeTabs(config.modRequest.projectRoot);
  return config;
}]);
module.exports.patchCrimsonNativeTabs = patchCrimsonNativeTabs;
