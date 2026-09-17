import React, { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { DemoCard } from './DemoCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'

/**
 * Dialog tracking demo.
 *
 * With `captureDialogEvents` set on `<Connect>`, the SDK intercepts
 * `Alert.alert()` and logs a dialog-show event when the alert appears, a
 * button-click event for the button pressed, and a dismiss event otherwise.
 * The app keeps calling `Alert.alert` exactly as before — both sample apps
 * enable the flag on their `<Connect>` wrapper.
 *
 * Custom (non-Alert) dialogs use the `useDialogTracking` hook or the
 * `withAcousticAutoDialog` HOC exported by the SDK.
 */
export function DialogCard() {
  const [last, setLast] = useState<string | null>(null)

  const show = useCallback(() => {
    Alert.alert('Showcase dialog', 'Pick a button — each press is logged.', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => setLast('Cancel pressed'),
      },
      { text: 'OK', onPress: () => setLast('OK pressed') },
    ])
  }, [])

  return (
    <DemoCard title="Dialogs">
      <Text style={styles.body}>
        Opens a standard {'`Alert.alert`'}. With {'`captureDialogEvents`'} on
        {' `<Connect>`'}, the SDK logs the dialog showing, the button pressed
        and any dismissal, with no change to how the alert is called.
      </Text>
      <PrimaryButton
        testID="btn_showcase_dialog"
        title="Show a dialog"
        onPress={show}
      />
      {last ? (
        <Text testID="txt_showcase_dialog_result" style={styles.mono}>
          {last}
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
