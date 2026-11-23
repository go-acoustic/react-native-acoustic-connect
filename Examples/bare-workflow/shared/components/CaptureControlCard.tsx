import React, { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { DemoCard } from './DemoCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { ConnectSDKManager } from '../services/ConnectSDKManager'
import { useManagerState } from '../services/useManagerState'

/**
 * Runtime capture control, and what it does and does not stop.
 *
 * `disable()` reaches `Connect.disable()`, which unregisters the SDK's activity
 * lifecycle callbacks and clears its enabled flag. Capture stops on both
 * platforms: the wrapper's own navigation-driven bridge methods now check the
 * enabled flag before doing anything, so nothing keeps capturing behind a
 * disabled SDK. Android used to be the exception — its bridge captured
 * unconditionally, consulting the per-screen `CaptureUserEvents` config but
 * never whether the SDK was still on — and that gap is closed.
 *
 * Tap Disable, then move between screens and watch for further layout messages:
 * there should be none until Re-enable.
 *
 * Built with `AutoStart: false`, the card shows `txt_capture_consent_pending`
 * until Enable stands in for the user's consent.
 */
export function CaptureControlCard() {
  const [state, setState] = useState<string | null>(null)
  const { consentPending } = useManagerState()

  const disable = useCallback(() => {
    const ok = AcousticConnectRN.disable()
    setState(
      `disable() returned ${ok} — now navigate and check for further layout captures`
    )
  }, [])

  const enable = useCallback(() => {
    const ok = ConnectSDKManager.enable()
    setState(`enable() returned ${ok}`)
  }, [])

  return (
    <DemoCard title="Runtime capture control">
      <Text style={styles.body}>
        `disable()` stops capture on both platforms. Confirm it on the build in
        front of you rather than assuming: tap Disable, navigate a few screens,
        and check that no further layout messages arrive.
      </Text>
      {consentPending ? (
        <Text testID="txt_capture_consent_pending" style={styles.mono}>
          Consent pending: AutoStart is false and the app has not called
          enable() yet. Tap Enable SDK to start capture.
        </Text>
      ) : null}
      <PrimaryButton
        testID="btn_capture_disable"
        title="Disable SDK"
        onPress={disable}
      />
      <PrimaryButton
        testID="btn_capture_enable"
        title={consentPending ? 'Enable SDK' : 'Re-enable SDK'}
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
