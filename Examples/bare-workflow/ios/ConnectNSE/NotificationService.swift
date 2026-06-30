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

// Notification Service Extension principal class — referenced by
// `NSExtensionPrincipalClass` in this target's Info.plist.
//
// The whole implementation is inherited from `ConnectNotificationService`
// (Connect SDK): it downloads rich-media attachments, records the
// `PushReceived` signal into the App Group pending store, and flushes it to
// the Collector. The only host responsibility is to point the extension at
// the SAME App Group as the host app so the two processes share state.
//
// This mirrors the iOS-SDK `ConnectPushDemo/ConnectNSE` reference 1:1 — the
// Expo Config Plugin generates the equivalent
// file for Expo projects; this is the manual-setup path.
//
// @unchecked Sendable: restates the inherited conformance from
// `ConnectNotificationService`.
final class NotificationService: ConnectNotificationService, @unchecked Sendable {
    override var appGroupIdentifier: String? {
        "group.co.acoustic.mobile.connect.new.rn.demo.external.ConnectBareWorkflowDemo"
    }
}
