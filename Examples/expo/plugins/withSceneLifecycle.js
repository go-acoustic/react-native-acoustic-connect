// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// Adopts the UIKit scene life cycle in the generated iOS app.
//
// Apps built with the iOS 27 SDK must use scenes, or iOS refuses to launch them
// (EXC_BREAKPOINT in _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
// Expo 57 ships ExpoAppSceneDelegate, but its AppDelegate template still creates
// the window at launch and declares no scene, so on every `expo prebuild` this plugin:
//   - declares ExpoAppSceneDelegate in Info.plist (UIApplicationSceneManifest),
//   - makes AppDelegate an ExpoReactNativeFactoryProvider, which that scene
//     delegate needs to start React Native in the window it creates,
//   - removes the window creation from AppDelegate.swift.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// Expo SDK 57's template code in AppDelegate.swift.
const CLASS_DECLARATION = 'class AppDelegate: ExpoAppDelegate {';
const PROVIDER_DECLARATION = 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';
const WINDOW_CREATION = /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\s*#endif\n/;

const withSceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(`withSceneLifecycle: expected a Swift AppDelegate, got ${cfg.modResults.language}`);
    }
    const { contents } = cfg.modResults;
    if (contents.includes(PROVIDER_DECLARATION) && !WINDOW_CREATION.test(contents)) {
      return cfg;
    }
    if (!contents.includes(CLASS_DECLARATION) || !WINDOW_CREATION.test(contents)) {
      throw new Error(
        'withSceneLifecycle: AppDelegate.swift does not match the Expo 57 template; update the plugin.'
      );
    }
    cfg.modResults.contents = contents
      .replace(CLASS_DECLARATION, PROVIDER_DECLARATION)
      .replace(WINDOW_CREATION, '');
    return cfg;
  });

module.exports = (config) => withSceneAppDelegate(withSceneManifest(config));
