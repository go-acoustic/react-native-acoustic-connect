import React, { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { DemoCard } from './DemoCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'

/**
 * `logExceptionEvent` demo.
 *
 * Unhandled JS errors are reported automatically through the SDK's global
 * error handler. This card covers the other case: an error the app caught and
 * recovered from, which is invisible to the SDK unless the app reports it.
 * `unhandled` is false here because the app handled it.
 */
export function ExceptionCard() {
  const [result, setResult] = useState<string | null>(null)

  const report = useCallback(() => {
    try {
      throw new Error('Showcase: handled exception')
    } catch (error) {
      const err = error as Error
      const ok = AcousticConnectRN.logExceptionEvent(
        err.message,
        err.stack ?? '',
        false
      )
      setResult(`${ok ? '✓' : '✗'} queued exception "${err.message}"`)
    }
  }, [])

  return (
    <DemoCard title="Exceptions">
      <Text style={styles.body}>
        Unhandled errors are reported automatically. For errors your app
        catches, {'`logExceptionEvent(message, stack, unhandled)`'} reports them
        explicitly. This button throws, catches and reports one.
      </Text>
      <PrimaryButton
        testID="btn_showcase_exception"
        title="Log a handled exception"
        onPress={report}
      />
      {result ? (
        <Text testID="txt_showcase_exception_result" style={styles.mono}>
          {result}
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
