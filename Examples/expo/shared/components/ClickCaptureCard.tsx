import React, { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { DemoCard } from './DemoCard'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'

/**
 * Click capture demo. There is no SDK call here on purpose: `<Connect>` wraps
 * the navigation tree with `onStartShouldSetResponderCapture`, so every touch
 * is logged as a click event before the pressed component handles it.
 *
 * The control id in the posted event is the touched view's `id` prop. The
 * button carries one so the event is recognisable; a view without `id` logs
 * an empty control id, which is the common case in an unlabelled UI.
 */
export function ClickCaptureCard() {
  const [taps, setTaps] = useState(0)

  return (
    <DemoCard title="Taps">
      <Text style={styles.body}>
        Every touch inside {'`<Connect>`'} is logged as a click event with the
        native view tag and the view's {'`id`'} prop as control id. Nothing to
        call — tap the button and look for the click event in the next post.
      </Text>
      <PrimaryButton
        id="showcase_tap_target"
        testID="btn_showcase_tap"
        title="Tap me"
        onPress={() => setTaps((count) => count + 1)}
      />
      <Text testID="txt_showcase_taps" style={styles.mono}>
        taps: {taps} · control id: showcase_tap_target
      </Text>
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
