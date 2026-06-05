import { PermissionsAndroid, Platform } from 'react-native'

/**
 * Cross-platform notification authorization helper.
 *
 * **iOS:** `pushRequestPermission()` is provided by the SDK bridge. Until the
 * sample is wired to it, this returns `notDetermined` on iOS so the demo's
 * Push tab can still be rendered without a hard dependency on the bridge
 * method. Replace the iOS branches below with calls to
 * `AcousticConnectRN.pushRequestPermission()`.
 *
 * **Android:** Uses the built-in `PermissionsAndroid` API for
 * `POST_NOTIFICATIONS` (required on Android 13+; auto-granted on older).
 */

export type AuthorizationStatus =
  | 'notDetermined'
  | 'authorized'
  | 'denied'
  | 'provisional'
  | 'ephemeral'

export type AuthorizationResult = {
  status: AuthorizationStatus
  error?: string
}

export async function getAuthorizationStatus(): Promise<AuthorizationStatus> {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) {
      return 'authorized'
    }
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    )
    return granted ? 'authorized' : 'notDetermined'
  }
  // iOS: not yet wired to the SDK bridge — see file header.
  return 'notDetermined'
}

export async function requestAuthorization(): Promise<AuthorizationResult> {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) {
      return { status: 'authorized' }
    }
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      )
      return {
        status:
          result === PermissionsAndroid.RESULTS.GRANTED
            ? 'authorized'
            : result === PermissionsAndroid.RESULTS.DENIED
              ? 'denied'
              : 'notDetermined',
      }
    } catch (error) {
      return {
        status: 'denied',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  // iOS placeholder — replace with AcousticConnectRN.pushRequestPermission().
  return {
    status: 'notDetermined',
    error:
      'iOS push permission is provided by pushRequestPermission() (not yet wired into this sample).',
  }
}

export function statusText(status: AuthorizationStatus): string {
  switch (status) {
    case 'notDetermined':
      return 'Not Requested'
    case 'denied':
      return 'Denied'
    case 'authorized':
      return 'Authorized'
    case 'provisional':
      return 'Provisional'
    case 'ephemeral':
      return 'Ephemeral'
  }
}
