// Crimson iPhone tabs adapter v3
// UIKit 27 no longer promotes legacy UITabBarItemSearch into a separate button.
// Keep React Navigation's existing controllers and state machine behind UITab.
#if !TARGET_OS_TV && !TARGET_OS_VISION && __IPHONE_OS_VERSION_MAX_ALLOWED >= 270000
- (BOOL)crimsonInstallTabsIfNeeded
{
  if (@available(iOS 27.0, *)) {
    if (UIDevice.currentDevice.userInterfaceIdiom != UIUserInterfaceIdiomPhone) return NO;
    BOOL hasSearch = NO;
    for (RNSTabsScreenViewController *controller in _tabScreenControllers) {
      hasSearch |= controller.tabScreenComponentView.systemItem == RNSTabsScreenSystemItemSearch;
    }
    if (!_crimsonUsesTabs && !hasSearch) return NO;
    UIViewController *previous = [self crimsonSelectedController];
    BOOL updating = _isHandlingExplicitSelectionUpdate;
    _isHandlingExplicitSelectionUpdate = YES;
    NSMutableArray<UITab *> *tabs = [NSMutableArray new];
    for (RNSTabsScreenViewController *controller in _tabScreenControllers) {
      UITab *tab = nil;
      // Retain identity (and the controller's navigation stack) on React updates.
      for (UITab *candidate in self.tabs) {
        if (candidate.viewController == controller) { tab = candidate; break; }
      }
      if (tab == nil) {
        if (controller.tabScreenComponentView.systemItem == RNSTabsScreenSystemItemSearch) {
          UISearchTab *search = [[UISearchTab alloc] initWithViewControllerProvider:^UIViewController *(UITab *) {
            return controller;
          }];
          search.automaticallyActivatesSearch = YES;
          tab = search;
        } else {
          tab = [[UITab alloc] initWithTitle:controller.tabBarItem.title ?: @""
                                      image:controller.tabBarItem.image
                                 identifier:controller.getScreenKeyOrNull
                     viewControllerProvider:^UIViewController *(UITab *) { return controller; }];
        }
      }
      [tabs addObject:tab];
    }
    _crimsonUsesTabs = YES;
    [self setTabs:tabs animated:NO];
    for (UITab *tab in tabs) {
      if ([tab isKindOfClass:UISearchTab.class]) self.prominentTabIdentifier = tab.identifier;
      if (tab.viewController == previous) self.selectedTab = tab;
    }
    _isHandlingExplicitSelectionUpdate = updating;
    [self setNeedsUpdateOfTabBarAppearance:YES];
    return YES;
  }
  return NO;
}

- (BOOL)tabBarController:(UITabBarController *)controller shouldSelectTab:(UITab *)tab API_AVAILABLE(ios(18.0))
{
  // Forward taps/repeated taps through the same prevention, events and provenance
  // handling as legacy tabs. Programmatic selection must not emit a second event.
  _crimsonUserTabSelection = [self tabBarController:controller shouldSelectViewController:tab.viewController];
  return _crimsonUserTabSelection;
}

- (void)tabBarController:(UITabBarController *)controller didSelectTab:(UITab *)tab
            previousTab:(UITab *)previous API_AVAILABLE(ios(18.0))
{
  if (!_crimsonUserTabSelection) return;
  _crimsonUserTabSelection = NO;
  [self tabBarController:controller didSelectViewController:tab.viewController];
}
#endif

// Do not override UIKit getters: it must perform its own initial containment.
- (NSArray<__kindof UIViewController *> *)crimsonInstalledControllers
{
  if (_crimsonUsesTabs) return _tabScreenControllers;
  return [super viewControllers];
}

- (UIViewController *)crimsonSelectedController
{
#if !TARGET_OS_TV && !TARGET_OS_VISION && __IPHONE_OS_VERSION_MAX_ALLOWED >= 270000
  if (@available(iOS 27.0, *)) {
    if (_crimsonUsesTabs) return self.selectedTab.viewController;
  }
#endif
  return [super selectedViewController];
}

- (void)crimsonSelectController:(UIViewController *)controller
{
#if !TARGET_OS_TV && !TARGET_OS_VISION && __IPHONE_OS_VERSION_MAX_ALLOWED >= 270000
  if (@available(iOS 27.0, *)) {
    if (_crimsonUsesTabs) {
      for (UITab *tab in self.tabs) {
        if (tab.viewController == controller) { self.selectedTab = tab; break; }
      }
      return;
    }
  }
#endif
  [self setSelectedViewController:controller];
}
