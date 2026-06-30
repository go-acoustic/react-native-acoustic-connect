import AsyncStorage from '@react-native-async-storage/async-storage'
import AcousticConnectRN from 'react-native-acoustic-connect'
import {
  getPermissionState,
  requestPermission,
  type PermissionTriState,
  type RequestResult,
} from './pushPermission'

/**
 * Lightweight singleton that wraps the Connect SDK and exposes the demo's
 * mutable state (auth status, identity history, last identity-log result).
 *
 * Pattern mirrors the iOS sample's `ConnectSDKManager` ObservableObject
 * (`Services/ConnectSDKManager.swift`). RN doesn't have Combine, so we use
 * a tiny pub/sub: components call `subscribe()` and re-render on change.
 *
 * **SDK initialisation.** The demo follows the canonical client setup:
 * credentials come from the bundled `ConnectConfig.json` at the project
 * root. The SDK's `applyConfiguration` script propagates them at install
 * time into `ios/AcousticConnectRNConfig.json` and
 * `android/src/main/assets/ConnectBasicConfig.properties`; the native
 * bridge auto-initialises from those files on cold start. The JS-side
 * `AcousticConnectRN.enable()` call is a zero-arg idempotent kick — it
 * confirms the SDK is up and is safe to repeat (the native layer
 * short-circuits via `Connect.isEnabled()`).
 *
 * **Identity logging.** Uses the dedicated `AcousticConnectRN.logIdentity(...)`
 * bridge method, which wraps `ConnectSDK.shared.identity.log` on iOS and
 * `Connect.logIdentificationEvent` on Android. It is async and resolves with
 * the SDK's real success value.
 */

const IDENTITY_HISTORY_KEY = 'connectDemo.identityHistory'
const HISTORY_LIMIT = 5

export type IdentityPair = { name: string; value: string }

export type ManagerState = {
  permissionState: PermissionTriState
  identityHistory: IdentityPair[]
  identityLogResult: string | null
  sdkEnabled: boolean
}

type Listener = (state: ManagerState) => void

class ConnectSDKManagerImpl {
  private state: ManagerState = {
    permissionState: null,
    identityHistory: [],
    identityLogResult: null,
    sdkEnabled: false,
  }

  private listeners = new Set<Listener>()

  getState(): ManagerState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(patch: Partial<ManagerState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  /**
   * Boot the SDK. The native bridge auto-initialises the Connect SDK on
   * cold start from the bundled `ConnectConfig.json` (`Connect.init` +
   * `Connect.enable` invoked from the package's main-looper handler),
   * so this call is normally a no-op that just confirms the SDK is up.
   *
   * The bridge's `enable()` is idempotent at the native layer — repeated
   * calls short-circuit once the SDK is running. Pushing this from JS at
   * mount time is still useful as a "kick" for the case where the native
   * cold-start path hasn't fired yet (e.g. dev hot reload).
   */
  async start(): Promise<void> {
    const history = await this.loadIdentityHistory()
    const enabled = AcousticConnectRN.enable()
    const state = await getPermissionState()
    this.setState({
      sdkEnabled: enabled,
      identityHistory: history,
      permissionState: state,
    })
  }

  /** Re-reads the permission tri-state without prompting (e.g. on foreground). */
  async refreshPermissionState(): Promise<void> {
    const state = await getPermissionState()
    this.setState({ permissionState: state })
  }

  /**
   * Requests notification permission via the SDK (`pushRequestPermission`).
   * Presents the system prompt when undetermined and updates the displayed
   * status from the resolved result. Never rejects.
   */
  async requestPermission(): Promise<RequestResult> {
    const result = await requestPermission()
    this.setState({ permissionState: result.granted })
    return result
  }

  logUserLoggedIn(identifierName: string, identifierValue: string): void {
    // Fire-and-forget, but handle the rejection: an unhandled Promise rejection
    // surfaces as a Hermes warning (and can crash in strict mode).
    this.logIdentity(identifierName, identifierValue, 'loggedIn', {
      loginMethod: 'email',
    }).catch((err) => console.warn('[Connect] logUserLoggedIn failed', err))
  }

  logUserRegistered(identifierName: string, identifierValue: string): void {
    this.logIdentity(identifierName, identifierValue, 'accountRegistered', {
      registrationMethod: 'email',
    }).catch((err) => console.warn('[Connect] logUserRegistered failed', err))
  }

  private async logIdentity(
    identifierName: string,
    identifierValue: string,
    signalType: string,
    additionalParameters: Record<string, string>
  ): Promise<void> {
    const trimmedName = identifierName.trim()
    const trimmedValue = identifierValue.trim()
    if (!trimmedName || !trimmedValue) return

    // Dedicated identity bridge: wraps the native identity loggers
    // (`ConnectSDK.shared.identity.log` on iOS, `Connect.logIdentificationEvent`
    // on Android). Async — resolves with the SDK's actual success value, and
    // returns `false` for a blank identifier (already guarded above).
    const success = await AcousticConnectRN.logIdentity(
      trimmedName,
      trimmedValue,
      signalType,
      additionalParameters
    )

    const pair: IdentityPair = { name: trimmedName, value: trimmedValue }
    const filtered = this.state.identityHistory.filter(
      (p) => p.name !== pair.name
    )
    const nextHistory = [pair, ...filtered].slice(0, HISTORY_LIMIT)

    this.setState({
      identityLogResult: success
        ? `✓ ${trimmedName}: ${trimmedValue}`
        : `✗ Failed to log ${trimmedName}`,
      identityHistory: nextHistory,
    })

    AsyncStorage.setItem(
      IDENTITY_HISTORY_KEY,
      JSON.stringify(nextHistory)
    ).catch((err) =>
      console.warn('[Connect] failed to persist identity history', err)
    )
  }

  private async loadIdentityHistory(): Promise<IdentityPair[]> {
    const raw = await AsyncStorage.getItem(IDENTITY_HISTORY_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is IdentityPair =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as IdentityPair).name === 'string' &&
          typeof (item as IdentityPair).value === 'string'
      )
    } catch {
      return []
    }
  }
}

export const ConnectSDKManager = new ConnectSDKManagerImpl()
