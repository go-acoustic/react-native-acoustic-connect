//
// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any
// intellectual or industrial property rights of Acoustic, L.P. except as may
// be provided in an agreement with Acoustic, L.P. Any unauthorized copying or
// distribution of content from this file is prohibited.
//

import Connect

// Notification Content Extension principal class — referenced by
// `NSExtensionPrincipalClass` in this target's Info.plist.
//
// The whole implementation is inherited from
// `ConnectNotificationContentExtension` (Connect SDK): it renders the rich
// expansion UI (media attachment and/or expanded body) below the system
// banner when the user long-presses / expands an Acoustic notification.
//
// As with the NSE, the only host responsibility is to share the SAME App
// Group as the host app and the NSE so all three processes read/write the
// same pending store. Mirrors the iOS-SDK `ConnectPushDemo/ConnectNCE`
// reference 1:1.
final class NotificationViewController: ConnectNotificationContentExtension {
    override var appGroupIdentifier: String? {
        "group.co.acoustic.mobile.connect.new.rn.demo.external.ConnectBareWorkflowDemo"
    }
}
