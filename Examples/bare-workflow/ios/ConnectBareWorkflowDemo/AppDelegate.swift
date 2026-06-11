import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Connect
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "ConnectBareWorkflowDemo",
      in: window,
      launchOptions: launchOptions
    )

    // ── Acoustic Connect push wiring ───────────────────────────────────────
    //
    // The demo defaults to `iOSPushMode: "automatic"` (ConnectConfig.json). In
    // automatic mode the SDK owns the entire APNs + notification lifecycle:
    // when it enables (from the RN bridge, after this method) it registers for
    // remote notifications and installs itself as the EXCLUSIVE
    // `UNUserNotificationCenter` delegate. The app must NOT set that delegate in
    // automatic mode — the SDK asserts on exclusive ownership and the app would
    // otherwise crash at enable() (see ConnectNotificationCenterProxy).
    //
    // Only in `iOSPushMode: "manual"` does the host app own the delegate and
    // forward each lifecycle event to `ConnectSDK.shared.push.*` (mirrors the
    // iOS-SDK `ConnectPushDemo` reference). So gate the wiring on the configured
    // mode, read from the same bundled config the SDK consumes. Installing the
    // delegate here (before this method returns) also ensures a cold-start
    // notification tap is delivered in manual mode.
    if Self.configuredPushMode() == "manual" {
      UNUserNotificationCenter.current().delegate = self
      application.registerForRemoteNotifications()
    }

    return true
  }

  /// Reads `Connect.iOSPushMode` from the bundled `AcousticConnectRNConfig`
  /// (the same config the SDK consumes) so the app's notification-delegate
  /// wiring matches the configured mode. Defaults to `"automatic"` — the SDK
  /// default — when the config or field is absent. Lowercased for a tolerant
  /// compare.
  static func configuredPushMode() -> String {
    let candidates = [
      Bundle.main.url(
        forResource: "AcousticConnectRNConfig",
        withExtension: "json",
        subdirectory: "AcousticConnectRNConfig.bundle"
      ),
      Bundle.main.url(forResource: "AcousticConnectRNConfig", withExtension: "json"),
    ].compactMap { $0 }

    for url in candidates {
      guard
        let data = try? Data(contentsOf: url),
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let connect = json["Connect"] as? [String: Any],
        let mode = connect["iOSPushMode"] as? String,
        !mode.isEmpty
      else { continue }
      return mode.lowercased()
    }
    return "automatic"
  }

  // MARK: - APNs registration (manual mode)

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Forward the raw APNs token to the SDK. On the JS side the same call is
    // exposed as `AcousticConnectRN.pushDidRegisterWithToken(deviceToken)` for
    // apps that obtain the token in JavaScript (e.g. via a notification
    // library); a bare RN app receives it natively, so we forward here.
    // `push` is a throwing accessor (throws when push is disabled); `try?`
    // swallows that and the manual-mode guard — token forwarding is best-effort.
    Task { @MainActor in
      try? await ConnectSDK.shared.push.didRegisterWithToken(deviceToken)
    }
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    Task { @MainActor in
      try? await ConnectSDK.shared.push.didFailToRegisterWithError(error)
    }
  }
}

// MARK: - UNUserNotificationCenterDelegate (foreground delivery + taps)

extension AppDelegate: UNUserNotificationCenterDelegate {
  // Notification delivered while the app is in the foreground. Forwarding it
  // lets the SDK record a `PushReceived` (msg 25) signal; the demo also shows
  // the banner so the tester can see and tap it.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // `UNNotification` conforms to `ConnectNotification`, so it is passed
    // straight through with no adapter.
    try? ConnectSDK.shared.push.didReceiveNotification(notification)
    completionHandler([.banner, .badge, .sound])
  }

  // User tapped the banner or an action button. Forwarding the response lets
  // the SDK run built-in actions (OPEN_URL, OPEN_DIALER, …) and record a
  // `PushAction` (msg 23) signal.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // `UNNotificationResponse` conforms to `ConnectNotificationResponse`.
    try? ConnectSDK.shared.push.didReceive(response)
    completionHandler()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
