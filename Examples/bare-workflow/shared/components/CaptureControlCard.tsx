import React, { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { DemoCard } from './DemoCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'

/**
 * Runtime capture control, and what it does and does not stop.
 *
 * `disable()` reaches `Connect.disable()`, which unregisters the SDK's activity
 * lifecycle callbacks and clears its enabled flag — so on iOS, where the React
 * Native wrapper only advances the current screen name, nothing drives capture
 * afterwards and it genuinely stops.
 *
 * Android differs, and not because of the native SDK. The wrapper calls
 * `logScreenLayout` on every navigation there, and that bridge method captures
 * unconditionally — it consults the per-screen `CaptureUserEvents` config but
 * never asks whether the SDK is still enabled. So an explicit navigation-driven
 * capture continues after `disable()`.
 *
 * Tap Disable, then move between screens and watch for further layout messages.
 */
export function CaptureControlCard() {
  const [state, setState] = useState<string | null>(null)

  const disable = useCallback(() => {
    const ok = AcousticConnectRN.disable()
    setState(
      `disable() returned ${ok} — now navigate and check for further layout captures`
    )
  }, [])

  const enable = useCallback(() => {
    const ok = AcousticConnectRN.enable()
    setState(`enable() returned ${ok}`)
  }, [])

  return (
    <DemoCard title="Runtime capture control">
      <Text style={styles.body}>
        Whether `disable()` actually stops capture is platform-dependent. Use
        this to check on the build in front of you rather than assuming.
      </Text>
      <PrimaryButton
        testID="btn_capture_disable"
        title="Disable SDK"
        onPress={disable}
      />
      <PrimaryButton
        testID="btn_capture_enable"
        title="Re-enable SDK"
        onPress={enable}
      />
      {state ? (
        <Text testID="txt_capture_state" style={styles.mono}>
          {state}
        </Text>
      ) : null}
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  mono: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
