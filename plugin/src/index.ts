// Copyright (C) 2026 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any
// intellectual or industrial property rights of Acoustic, L.P. except as may
// be provided in an agreement with Acoustic, L.P. Any unauthorized copying or
// distribution of content from this file is prohibited.

import { type ConfigPlugin } from '@expo/config-plugins'
import { withConnectNSE, type ConnectPluginProps } from './withConnectNSE'
import { withConnectNCE } from './withConnectNCE'
import {
  withConnectAndroidConfig,
  withConnectAndroidGoogleServicesMatch,
} from './withConnectAndroidConfig'
import { withConnectIosSigning } from './withConnectIosSigning'

/**
 * Expo Config Plugin for react-native-acoustic-connect.
 *
 * iOS: provisions the ConnectNSE Notification Service Extension and the
 * ConnectNCE Notification Content Extension targets during `expo prebuild`.
 *
 * Android: wires the SDK's config.gradle into the generated app build so
 * ConnectConfig.json values (collector URL, app key) reach the native assets
 * at build time (withConnectAndroidConfig). FCM push needs no mod here — Expo
 * wires the google-services Gradle plugin natively when the consumer sets
 * `android.googleServicesFile` in app.json.
 *
 * Designed as a chainable composition: additional mods are appended by adding
 * to the mods array. Order matters for the iOS pair — withConnectNSE runs
 * first so it seeds the host entitlements and the
 * PBXTargetDependency/PBXContainerItemProxy sections that withConnectNCE
 * reuses. The Android mod is independent of that ordering.
 *
 * Consumer app.json usage:
 *   // With explicit App Group + signing team overrides:
 *   ["react-native-acoustic-connect", {
 *     "iosAppGroupIdentifier": "group.com.example.app",
 *     "iosDevelopmentTeam": "ABCDE12345"   // 10-char Apple Team ID — required
 *                                          // for push (else aps-environment is
 *                                          // dropped to ad-hoc, no APNs token)
 *   }]
 *
 *   // Without props (reads iOSAppGroupIdentifier / iOSDevelopmentTeam from
 *   // ConnectConfig.json):
 *   "react-native-acoustic-connect"
 */
const withAcousticConnect: ConfigPlugin<ConnectPluginProps | void> = (
  config,
  props
) => {
  const resolvedProps: ConnectPluginProps =
    props != null && typeof props === 'object' ? props : {}

  // Chainable composition array. Order matters:
  //  - withConnectNSE must precede withConnectNCE: the NSE mod seeds the host
  //    App Group entitlement and the PBXTargetDependency/PBXContainerItemProxy
  //    sections the NCE mod relies on.
  //  - withConnectIosSigning must follow both so the ConnectNSE/ConnectNCE
  //    targets exist before it stamps DEVELOPMENT_TEAM onto them.
  // The Android mods are independent of that ordering.
  const mods: Array<ConfigPlugin<ConnectPluginProps>> = [
    withConnectNSE,
    withConnectNCE,
    withConnectIosSigning,
    withConnectAndroidConfig,
    withConnectAndroidGoogleServicesMatch,
  ]

  return mods.reduce((accConfig, mod) => mod(accConfig, resolvedProps), config)
}

export default withAcousticConnect
export {
  withConnectNSE,
  withConnectNCE,
  withConnectIosSigning,
  withConnectAndroidConfig,
  withConnectAndroidGoogleServicesMatch,
}
export type { ConnectPluginProps }
