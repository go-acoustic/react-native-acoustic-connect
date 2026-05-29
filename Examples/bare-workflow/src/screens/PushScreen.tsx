import React, { useCallback, useEffect, useState } from 'react'
import {
  AppState,
  type AppStateStatus,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native'
import { DemoCard } from '../components/DemoCard'
import { LogoHeader } from '../components/LogoHeader'
import { PrimaryButton } from '../components/buttons'
import { StatusRow } from '../components/StatusRow'
import { ConnectSDKManager } from '../services/ConnectSDKManager'
import {
  statusText,
  type AuthorizationStatus,
} from '../services/pushPermission'
import { useManagerState } from '../services/useManagerState'
import { Colors } from '../theme/colors'

/**
 * Push tab — mirrors the iOS sample's `PushDemoView`
 * (`Scenes/PushDemo/PushDemoView.swift`). Shows the OS authorization status
 * and a Request Authorization button. Refreshes when the app returns to the
 * foreground, the same trick the iOS view uses with `scenePhase == .active`.
 *
 * Permission-request feedback is rendered inline rather than via
 * `Alert.alert`. RN's `Alert.alert` on iOS presents a `UIAlertController`
 * that lives outside the React tree; the SDK's auto-instrumentation reacts
 * to the alert's animation by capturing dozens of layout/screen-view
 * events per show. Inline rendering keeps the captured signal one-tap-one-
 * event.
 */
export function PushScreen() {
  const state = useManagerState()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void ConnectSDKManager.refreshAuthorizationStatus()
    const sub = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') {
          void ConnectSDKManager.refreshAuthorizationStatus()
        }
      }
    )
    return () => sub.remove()
  }, [])

  const onRequest = useCallback(async () => {
    const result = await ConnectSDKManager.requestPushAuthorization()
    setMessage(result.error ?? null)
  }, [])

  const canRequest = state.authorizationStatus === 'notDetermined'

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
          value={statusText(state.authorizationStatus)}
          indicatorColor={indicatorColor(state.authorizationStatus)}
        />
        <PrimaryButton
          title="Request Authorization"
          onPress={onRequest}
          disabled={!canRequest}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </DemoCard>
    </ScrollView>
  )
}

function indicatorColor(status: AuthorizationStatus): string {
  switch (status) {
    case 'authorized':
    case 'provisional':
    case 'ephemeral':
      return Colors.acousticGreen
    case 'denied':
    case 'notDetermined':
      return Colors.middleGrey
  }
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  message: {
    fontSize: 12,
    color: Colors.darkGrey,
    fontStyle: 'italic',
  },
})
