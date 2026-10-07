//
// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any
// intellectual or industrial property rights of Acoustic, L.P. except as may
// be provided in an agreement with Acoustic, L.P. Any unauthorized copying or
// distribution of content from this file is prohibited.
//

import UIKit

/// Walks from a window's root view controller down to the screen a layout
/// capture should describe.
///
/// Split out of `HybridAcousticConnectRN` so the walk can be unit-tested
/// without a window, and compiled into the UnitTests bundle (see the
/// podspec's test_spec for why the pod module itself cannot be imported).
///
/// Must be called on the main thread.
enum ConnectRNScreenResolution {

    /// The view controller that is actually showing under `root`.
    ///
    /// Walks the `presentedViewController` chain, unwraps navigation and tab
    /// controllers to the child on screen, and descends into
    /// react-native-screens' controllers (see `activeScreen(in:)`).
    ///
    /// The react-native-screens step is what makes a capture name the same
    /// controller the SDK records for the screen. Those controllers are plain
    /// child view controllers of React Native's root, not navigation or tab
    /// containers, so without it the walk stopped at the root. The SDK, which
    /// records the `RNSScreen` from its `viewDidAppear`, then saw a capture of
    /// some other controller and posted a second LOAD for a screen already on
    /// display, naming itself as its referrer.
    ///
    /// - Parameter root: The window's root view controller.
    /// - Returns: The view controller to capture, or `nil` when `root` is nil.
    static func topViewController(from root: UIViewController?) -> UIViewController? {
        var top = root
        // Bounded rather than an open `while`. In practice the chain is a short
        // linked list, but this runs on every navigation, so a pathological
        // cycle must not hang the main thread.
        var hops = 0
        while hops < 32, let current = top {
            hops += 1
            // Presentation first: `presentedViewController` also reports a
            // modal put up by a descendant, so checking it before unwrapping a
            // container lands on the modal directly instead of on the
            // container's child underneath it.
            if let presented = current.presentedViewController {
                top = presented
                continue
            }
            if let nav = current as? UINavigationController,
               let visible = nav.topViewController {
                top = visible
                continue
            }
            if let tabs = current as? UITabBarController,
               let selected = tabs.selectedViewController {
                top = selected
                continue
            }
            if let screen = activeScreen(in: current) {
                top = screen
                continue
            }
            break
        }
        return top
    }

    /// The react-native-screens child of `viewController` that is showing, if
    /// it has one.
    ///
    /// - A screen container (`RNSViewController`) is asked through its own
    ///   `findActiveChildVC`, which react-native-screens also uses to route
    ///   status-bar and orientation queries to the screen on top; during a
    ///   transition several screens are attached and only it knows which one.
    /// - Anything else descends into its last visible react-native-screens
    ///   child: React Native's root holds the container that way, and a
    ///   screen holds a nested native stack (`RNSNavigationController`) that way.
    ///
    /// Only react-native-screens controllers are descended into, recognised by
    /// the class-name prefix the SDK itself matches on (`isRNSScreen:`), so an
    /// app that embeds React Native next to its own child controllers keeps
    /// the controller it had before.
    ///
    /// - Parameter viewController: The controller the walk has reached.
    /// - Returns: The child to continue from, or `nil` to stop at `viewController`.
    static func activeScreen(in viewController: UIViewController) -> UIViewController? {
        if isScreensController(viewController), let active = findActiveChild(of: viewController) {
            return active
        }
        return viewController.children.last { child in
            isScreensController(child) && child.viewIfLoaded?.isHidden != true
        }
    }

    /// Whether `viewController` belongs to react-native-screens.
    static func isScreensController(_ viewController: UIViewController) -> Bool {
        NSStringFromClass(type(of: viewController)).hasPrefix("RNS")
    }

    private static let findActiveChildSelector = NSSelectorFromString("findActiveChildVC")

    private static func findActiveChild(of container: UIViewController) -> UIViewController? {
        guard container.responds(to: findActiveChildSelector),
              let active = container.perform(findActiveChildSelector)?.takeUnretainedValue() as? UIViewController,
              active.parent === container else {
            return nil
        }
        return active
    }
}
