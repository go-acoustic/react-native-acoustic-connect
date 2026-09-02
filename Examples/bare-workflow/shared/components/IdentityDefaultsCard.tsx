import React, { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { TicketCard } from './TicketCard'
import { PrimaryButton, SecondaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { TICKETS } from '../verification/tickets'

/**
 * Verifies the bridge's own identity defaults (CA-156074).
 *
 * The Identity tab always passes an explicit signal type and parameter map, so
 * it never exercises the defaulting path — which is exactly where the bug was.
 * The first button omits both optional arguments, forcing the bridge to supply
 * them: it should resolve `loggedIn` and pair it with `loginMethod`, where it
 * used to pair `loggedIn` with `registrationMethod` and emit the wrong
 * attribute on every defaulted call.
 *
 * The second button is the contrast case — an explicit `accountRegistered`,
 * which legitimately uses `registrationMethod` — so a tester can tell a correct
 * `registrationMethod` from the defaulting bug.
 */
export function IdentityDefaultsCard() {
  const [result, setResult] = useState<string | null>(null)

  const logDefaulted = useCallback(async () => {
    // Both optional arguments omitted on purpose — this is the path under test.
    const ok = await AcousticConnectRN.logIdentity(
      'Email',
      'defaults@example.com'
    )
    setResult(`${ok ? '✓' : '✗'} defaulted — expect loginMethod: email`)
  }, [])

  const logExplicit = useCallback(async () => {
    const ok = await AcousticConnectRN.logIdentity(
      'Email',
      'explicit@example.com',
      'accountRegistered',
      { registrationMethod: 'email' }
    )
    setResult(`${ok ? '✓' : '✗'} explicit — expect registrationMethod: email`)
  }, [])

  return (
    <TicketCard ticket={TICKETS['CA-156074-identity']}>
      <PrimaryButton
        testID="btn_identity_defaulted"
        title="Log identity — omit both optional args"
        onPress={logDefaulted}
      />
      <SecondaryButton
        testID="btn_identity_explicit"
        title="Log accountRegistered — explicit"
        onPress={logExplicit}
      />
      {result ? (
        <Text testID="txt_identity_defaults_result" style={styles.mono}>
          {result}
        </Text>
      ) : null}
    </TicketCard>
  )
}

const styles = StyleSheet.create({
  mono: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
