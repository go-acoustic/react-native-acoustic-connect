import React, { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import AcousticConnectRN, {
  type SignalValues,
} from 'react-native-acoustic-connect-beta'
import { DemoCard } from './DemoCard'
import { PrimaryButton, SecondaryButton } from './buttons'
import { Colors } from '../theme/colors'

/**
 * `logSignal` reference card — the on-device check that a **nested** signal
 * payload reaches the collector with its structure intact.
 *
 * Why this needs a device and not just a unit test: the bridge hands the
 * payload to the native SDK, and each platform serialises it differently
 * (iOS embeds the dictionary verbatim once `isValidJSONObject:` passes;
 * Android rebuilds it as `JSONObject`/`JSONArray` because EOCore's signal
 * serialiser silently drops anything else). Only the posted payload proves
 * both paths agree.
 *
 * The nested button sends the Connect-on-Connect shape — a `signalContent`
 * object plus an `audience` array of `{ name, value }` objects — which is the
 * payload the widening was needed for. The flat button sends a scalar-only
 * map so a tester can confirm the same call still works for existing callers.
 *
 * To read the payload, point `PostMessageUrl` in `ConnectConfig.json` at a
 * local sink; the signal rides in a type-21 message under the `signal` key.
 * Note that a **top-level** number is dropped on Android (an SDK limitation in
 * `JsonUtil.getHashValues`); numbers nested inside an object or array survive,
 * which is why `cart.items` below sits one level down.
 */

const NESTED_PAYLOAD = {
  signalContent: {
    signalType: 'pageview',
    url: 'https://app.example.com/behaviour-demo',
    pageCategory: 'behaviour-demo',
  },
  audience: [
    { name: 'Account Name', value: 'Acme Corp' },
    { name: 'Account ID', value: '4815162342' },
  ],
  cart: { items: 3, total: 24.99, coupon: null },
}

const FLAT_PAYLOAD = {
  signalType: 'pageview',
  pageCategory: 'behaviour-demo',
}

export function NestedSignalCard() {
  const [result, setResult] = useState<string | null>(null)

  const send = useCallback((label: string, payload: SignalValues) => {
    // Synchronous bridge call — returns whether the SDK queued the signal.
    // A `true` here means accepted for posting, not yet delivered.
    const queued = AcousticConnectRN.logSignal(payload, 1)
    setResult(`${queued ? '✓' : '✗'} ${label} — ${JSON.stringify(payload)}`)
  }, [])

  const onNested = useCallback(() => send('nested', NESTED_PAYLOAD), [send])
  const onFlat = useCallback(() => send('flat', FLAT_PAYLOAD), [send])

  return (
    <DemoCard title="Log Signal">
      <Text style={styles.body}>
        Sends a signal through `logSignal`. The nested payload carries an object
        and an array of objects; the flat one is scalars only. Compare the
        `signal` block in the posted type-21 message across platforms.
      </Text>
      <PrimaryButton
        testID="btn_send_nested_signal"
        title="Send Nested Signal"
        onPress={onNested}
      />
      <SecondaryButton
        testID="btn_send_flat_signal"
        title="Send Flat Signal"
        onPress={onFlat}
      />
      {result ? (
        <View style={styles.resultBox}>
          <Text testID="txt_signal_result" style={styles.resultText}>
            {result}
          </Text>
        </View>
      ) : null}
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  resultBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  resultText: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
