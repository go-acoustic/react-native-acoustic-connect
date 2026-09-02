import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { DemoCard } from './DemoCard'
import { PrimaryButton, SecondaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { DIRECT_CASES, type ScreenViewCase } from '../screens/screenViewCases'

/**
 * Fires type-2 (screenview) messages with an exact, arbitrary logical page name
 * via `logScreenViewContextLoad`, for verifying the inferred-`pageView` url
 * fallback .
 *
 * Why this exists alongside the navigation-driven screens: the `<Connect>`
 * navigation path cannot carry a falsy name. `extractName` returns
 * `name ? name : route.name`, so an empty or null name silently becomes the
 * route name and the two cases most likely to still break the fallback would
 * never be sent. Calling the bridge directly is the only way to put '' and
 * null on the wire.
 *
 * Both platforms emit a type-2 from this call — iOS through
 * `ConnectCustomEvent.logScreenViewContext`, Android through
 * `Connect.logScreenview(..., ScreenviewType.LOAD, referrer)` — so the name
 * lands in `screenview.name`, which is what the server-side rule reads.
 */

const REFERRER = 'Screen View Diagnostics'

/** Renders a name so a blank or null one is visible rather than invisible. */
export function describeName(name: string | null): string {
  if (name === null) {
    return '(null)'
  }
  if (name === '') {
    return '(empty string)'
  }
  if (name.trim() === '') {
    return `(whitespace ×${name.length})`
  }
  if (name.length > 48) {
    return `${name.slice(0, 45)}… (${name.length} chars)`
  }
  return name
}

type Entry = { id: string; ok: boolean; shown: string }

export function DirectScreenViewCard() {
  const [log, setLog] = useState<Entry[]>([])

  const send = useCallback((testCase: ScreenViewCase) => {
    // Synchronous bridge call — the boolean says the SDK accepted the message
    // for the queue, not that the collector received it.
    const ok = AcousticConnectRN.logScreenViewContextLoad(
      testCase.name,
      REFERRER
    )
    setLog((prev) =>
      [
        { id: testCase.id, ok, shown: describeName(testCase.name) },
        ...prev,
      ].slice(0, 12)
    )
  }, [])

  const sendAll = useCallback(() => {
    for (const testCase of DIRECT_CASES) {
      send(testCase)
    }
  }, [send])

  return (
    <DemoCard title="Screen view — exact name">
      <Text style={styles.body}>
        Emits a type-2 screenview whose logical page name is the exact string
        below. The server-side rule uses that name as the inferred pageView's
        `url`, so each name is a separate test of the fallback. The empty and
        null names are only reachable here — navigation drops them.
      </Text>
      <PrimaryButton
        testID="btn_screenview_send_all"
        title={`Send all ${DIRECT_CASES.length} names`}
        onPress={sendAll}
      />
      {DIRECT_CASES.map((testCase) => (
        <View key={testCase.id} style={styles.caseBlock}>
          <SecondaryButton
            testID={`btn_screenview_${testCase.id}`}
            title={testCase.label}
            onPress={() => send(testCase)}
          />
          <Text style={styles.probes}>{testCase.probes}</Text>
        </View>
      ))}
      {log.length > 0 ? (
        <ScrollView style={styles.logBox} nestedScrollEnabled>
          {log.map((entry, index) => (
            <Text
              key={`${entry.id}-${index}`}
              testID={index === 0 ? 'txt_screenview_result' : undefined}
              style={styles.logText}
            >
              {entry.ok ? '✓' : '✗'} {entry.id} → {entry.shown}
            </Text>
          ))}
        </ScrollView>
      ) : null}
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  caseBlock: { gap: 6 },
  probes: { fontSize: 11, lineHeight: 16, color: Colors.darkGrey },
  logBox: {
    maxHeight: 140,
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  logText: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
