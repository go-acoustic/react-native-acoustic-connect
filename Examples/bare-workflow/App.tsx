import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { RootNavigator } from './src/navigation/RootNavigator'
import { ConnectSDKManager } from '@shared/services/ConnectSDKManager'
import { Colors } from '@shared/theme/colors'

/**
 * Root of the bare-workflow demo. Boots the SDK once on mount — reading
 * the saved App Key + Post URL from AsyncStorage and calling
 * `AcousticConnectRN.enable(appKey, postURL, 'off')`. Push features are out
 * of scope for this sample; a sibling sample adds them.
 *
 * This app is a setup-verification surface. If SDK init
 * fails the tabs must NOT render — a green-looking demo masks a broken
 * setup. Render an explicit error screen instead so the tester sees the
 * failure without having to dig through Metro / logcat.
 */
export default function App() {
  const [bootState, setBootState] = useState<
    { status: 'booting' } | { status: 'ready' } | { status: 'failed'; error: unknown }
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
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
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
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <Text style={styles.errorTitle}>SDK startup failed</Text>
        <Text style={styles.errorBody}>{message}</Text>
        <Text style={styles.errorHint}>
          Check ConnectConfig.json values and Metro / logcat for details.
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={Colors.background}
      />
      <RootNavigator />
    </SafeAreaProvider>
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
