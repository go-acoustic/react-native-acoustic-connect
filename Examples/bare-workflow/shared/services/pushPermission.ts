import AcousticConnectRN from 'react-native-acoustic-connect-beta'

/**
 * Cross-platform notification permission helper.
 *
 * Wired to the v19.x Connect bridge permission surface (iOS + Android):
 *
 *   - `pushRequestPermission()`  → presents the system prompt, resolves
 *     `{ granted, error? }`. Never rejects.
 *   - `pushGetPermissionState()` → reads the current state without prompting,
 *     resolves the tri-state `true | false | null`.
 *
 * The bridge dispatches the platform-appropriate native call internally, so
 * there is no `Platform.OS` branching here — both iOS and Android go through
 * the same JS methods.
 */

/** Tri-state notification permission: `true` granted, `false` denied, `null` not determined. */
export type PermissionTriState = boolean | null

/** Result of {@link requestPermission} — mirrors the bridge's `PushPermissionResult`. */
export type RequestResult = {
  granted: boolean
  error?: string | null
}

/** Presents the system permission prompt when undetermined. Never rejects. */
export async function requestPermission(): Promise<RequestResult> {
  return AcousticConnectRN.pushRequestPermission()
}

/** Reads the current permission tri-state without prompting. Never rejects. */
export async function getPermissionState(): Promise<PermissionTriState> {
  return AcousticConnectRN.pushGetPermissionState()
}

/** Status label matching the iOS sample's wording. */
export function authorizationStatusText(state: PermissionTriState): string {
  if (state === true) return 'Authorized'
  if (state === false) return 'Denied'
  return 'Not Requested'
}
