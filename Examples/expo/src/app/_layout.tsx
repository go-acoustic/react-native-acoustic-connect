import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Stack, useNavigationContainerRef } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
// Acoustic Connect auto-initialises at module load from ConnectConfig.json;
// importing the SDK here is the entire JS-side native setup. `<Connect>` is the
// analytics wrapper — see RootNavigator.tsx in the bare-workflow sample.
import { Connect } from 'react-native-acoustic-connect'
import { ConnectSDKManager } from '@shared/services/ConnectSDKManager'
import { Colors } from '@shared/theme/colors'

/**
 * Expo-router root layout — the Expo sibling of the bare-workflow demo's
 * `App.tsx` + `RootNavigator.tsx`. Expo is only the build tool: the UI is the
 * shared `@shared/*` source, so the two apps look and behave identically.
 *
 * Boots the SDK once on mount (`ConnectSDKManager.start()` reads the persisted
 * identity history and the notification permission state). This app is a
 * setup-verification surface — if SDK init fails the tabs must NOT render (a
 * green-looking demo masks a broken Expo Config Plugin / prebuild). We render
 * an explicit error screen instead.
 *
 * The router tree is wrapped in `<Connect>` with the navigation container ref
 * from `useNavigationContainerRef()` (re-exported by expo-router; it is the
 * same react-navigation container ref `<Connect>` consumes via
 * `addListener('state')` / `getCurrentRoute()`). Without it, RN-side screen
 * views and taps would not reach the collector.
 */
export default function RootLayout() {
  const navigationRef = useNavigationContainerRef()
  const [bootState, setBootState] = useState<
    | { status: 'booting' }
    | { status: 'ready' }
    | { status: 'failed'; error: unknown }
  >({ status: 'booting' })

  useEffect(() => {
    ConnectSDKManager.start()
      .then(() => setBootState({ status: 'ready' }))
      .catch((error) => {
        console.error('[ConnectDemo] SDK startup failed', error)
        setBootState({ status: 'failed', error })
      })
  }, [])

  if (bootState.status === 'booting') {
    return (
      <View style={styles.bootScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={Colors.periwinkle} />
      </View>
    )
  }

  if (bootState.status === 'failed') {
    const message =
      bootState.error instanceof Error
        ? bootState.error.message
        : String(bootState.error)
    return (
      <View style={styles.bootScreen}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>SDK startup failed</Text>
        <Text style={styles.errorBody}>{message}</Text>
        <Text style={styles.errorHint}>
          Check ConnectConfig.json values and Metro / logcat for details.
        </Text>
      </View>
    )
  }

  return (
    <Connect captureKeyboardEvents navigationRef={navigationRef}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </Connect>
  )
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.background,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.violet,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: Colors.violet,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: Colors.darkGrey,
    textAlign: 'center',
  },
})
