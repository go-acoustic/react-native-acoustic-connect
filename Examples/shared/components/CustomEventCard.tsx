import React, { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect'
import { ScenarioCard } from './ScenarioCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { SCENARIOS } from '../verification/scenarios'

/**
 * `logCustomEvent` demo body, shared by the Showcase (inside a plain DemoCard)
 * and the Verification screen (inside a ScenarioCard).
 *
 * The payload deliberately mixes all three value types the bridge accepts. On
 * the verification side that matters because the unwrapping bug hit every type
 * through the same path: a string must arrive as `pro`, not `Second(value=pro)`.
 *
 * One cross-platform wrinkle worth expecting rather than reporting as a defect:
 * a JS number crosses the bridge as a double, so Android renders `2` as `2.0`
 * while iOS keeps `2`.
 */

const PAYLOAD = {
  tier: 'pro',
  isTrial: false,
  seats: 2,
}

export function CustomEventBody() {
  const [result, setResult] = useState<string | null>(null)

  const send = useCallback(() => {
    const ok = AcousticConnectRN.logCustomEvent('demoCustomEvent', PAYLOAD, 1)
    setResult(
      `${
        ok ? '✓' : '✗'
      } queued demoCustomEvent — read customEvent in the posted message`
    )
  }, [])

  return (
    <>
      <View style={styles.payloadBox}>
        <Text style={styles.mono}>{JSON.stringify(PAYLOAD, null, 2)}</Text>
      </View>
      <PrimaryButton
        testID="btn_send_custom_event"
        title="Send custom event"
        onPress={send}
      />
      {result ? (
        <Text testID="txt_custom_event_result" style={styles.mono}>
          {result}
        </Text>
      ) : null}
    </>
  )
}

/** Verification frame: the body under its scenario's Do / Expect text. */
export function CustomEventCard() {
  return (
    <ScenarioCard scenario={SCENARIOS['custom-event-value-types']}>
      <CustomEventBody />
    </ScenarioCard>
  )
}

const styles = StyleSheet.create({
  payloadBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  mono: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
