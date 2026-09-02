import React, { useCallback, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { TicketCard } from './TicketCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { TICKETS } from '../verification/tickets'

/**
 * Verifies that custom-event values reach the collector as values rather than
 * as their Kotlin wrapper form (CA-151429).
 *
 * The payload deliberately mixes all three types the bridge accepts, because
 * the bug was in the variant unwrapping and every type went through the same
 * broken path. Read the `customEvent` values in the posted message: a string
 * must be `pro`, not `Second(value=pro)`.
 *
 * One cross-platform wrinkle worth expecting rather than reporting as a defect:
 * a JS number crosses the bridge as a double, so Android renders `2` as `2.0`
 * while iOS keeps `2`. The fix was about unwrapping, not about number
 * formatting.
 */

const PAYLOAD = {
  tier: 'pro',
  isTrial: false,
  seats: 2,
}

export function CustomEventCard() {
  const [result, setResult] = useState<string | null>(null)

  const send = useCallback(() => {
    const ok = AcousticConnectRN.logCustomEvent('demoCustomEvent', PAYLOAD, 1)
    setResult(
      `${ok ? '✓' : '✗'} queued — expect tier="pro", isTrial="false", seats="${
        Platform.OS === 'android' ? '2.0' : '2'
      }"`
    )
  }, [])

  return (
    <TicketCard ticket={TICKETS['CA-151429']}>
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
    </TicketCard>
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
