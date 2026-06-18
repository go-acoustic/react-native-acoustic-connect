import React, { useCallback, useEffect } from 'react'
import {
  AppState,
  type AppStateStatus,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { DemoCard } from '../components/DemoCard'
import { LogoHeader } from '../components/LogoHeader'
import { PrimaryButton } from '../components/buttons'
import { StatusRow } from '../components/StatusRow'
import { ConnectSDKManager } from '../services/ConnectSDKManager'
import {
  authorizationStatusText,
  type PermissionTriState,
} from '../services/pushPermission'
import { useManagerState } from '../services/useManagerState'
import { Colors } from '../theme/colors'

/**
 * Push tab — mirrors the iOS sample's `PushDemoView` notification-authorization
 * section. Shows the OS notification permission status and a Request
 * Authorization button, wired to the v19.x bridge (`pushGetPermissionState` /
 * `pushRequestPermission`, cross-platform). Refreshes on foreground, the same
 * trick the iOS view uses with `scenePhase == .active`.
 *
 * Push mode, app-group, and rich-media targets are configured in
 * `ConnectConfig.json` / the native projects — see the README's
 * "Mobile Push Setup". The SDK auto-enables at boot from the bundled config,
 * so the tab stays focused on the one runtime interaction: permission.
 */
export function PushScreen() {
  const state = useManagerState()

  useEffect(() => {
    void ConnectSDKManager.refreshPermissionState()
    const sub = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') {
          void ConnectSDKManager.refreshPermissionState()
        }
      }
    )
    return () => sub.remove()
  }, [])

  const onRequest = useCallback(() => {
    void ConnectSDKManager.requestPermission()
  }, [])

  const canRequest = state.permissionState === null

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Push Demo" />
      <DemoCard title="Notification Authorization">
        <StatusRow
          label="Status"
          value={authorizationStatusText(state.permissionState)}
          indicatorColor={indicatorColor(state.permissionState)}
        />
        <PrimaryButton
          title="Request Authorization"
          onPress={onRequest}
          disabled={!canRequest}
        />
      </DemoCard>
    </ScrollView>
  )
}

function indicatorColor(state: PermissionTriState): string {
  return state === true ? Colors.acousticGreen : Colors.middleGrey
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
})
