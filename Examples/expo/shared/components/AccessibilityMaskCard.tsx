import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { DemoCard } from './DemoCard'
import { DemoTextField } from './DemoTextField'
import { Colors } from '../theme/colors'

/**
 * Shows what masking does and does not cover on an accessibility-annotated
 * element, and the shape that keeps a screen reader useful without putting the
 * value on the wire.
 *
 * The problem this exists to make visible: masking redacts an element's
 * **value**, but the SDK serialises the accessibility object — `id`, `label`,
 * `hint` — verbatim, with no masking applied to any of it. On React Native
 * that matters more than on native, because RN derives `accessibilityLabel`
 * from a Text node's own content when no explicit label is set. So a masked
 * address can still travel in `accessibility.label`.
 *
 * The third row looks like it should solve that — iOS does not capture
 * `accessibilityValue` (its capture is commented out, "Remove accessibility
 * value for privacy reasons") and Android's `Accessibility` model has only
 * id/label/hint. Measured on Android, it does not: React Native folds
 * `accessibilityValue` into `contentDescription`, which is the very field the
 * SDK reads, so the wire shows
 * `"label":"Email address, analyticsp2@test.com"` — the address is back.
 *
 * So today only row 2 keeps the payload clean, at the cost of a screen reader
 * announcing the field's purpose but never its content. There is no
 * configuration that redacts `accessibility.label`: the mask lists select which
 * elements get masked, and masking is applied to the value only. Closing that
 * gap needs an SDK change, not app-side work.
 */

const ADDRESS = 'analyticsp2@test.com'

export function AccessibilityMaskCard() {
  const [typed, setTyped] = useState('')

  return (
    <DemoCard title="Masking vs the accessibility label">
      <Text style={styles.body}>
        Drive a capture, then compare these three rows in the layout message.
        Only row 2 keeps the address out of `accessibility` — and it silences
        the screen reader. Row 3 is the tempting fix that does not work.
      </Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>1 · no explicit label — leaks</Text>
        {/* RN fills accessibilityLabel from the text content, so the address
            reaches accessibility.label even when the value is masked. */}
        <Text testID="a11y_implicit" style={styles.value}>
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>
          2 · explicit label — clean, but mute
        </Text>
        {/* The customer's current workaround: the payload is clean, but the
            screen reader now says "Email address" and never the address. */}
        <Text
          testID="a11y_explicit"
          accessibilityLabel="Email address"
          style={styles.value}
        >
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>
          3 · label + value — clean and spoken
        </Text>
        <Text
          testID="a11y_value"
          accessibilityLabel="Email address"
          accessibilityValue={{ text: ADDRESS }}
          style={styles.value}
        >
          {ADDRESS}
        </Text>
      </View>

      <DemoTextField
        testID="a11y_field"
        label="Masked input (for comparison)"
        placeholder="SECRET-1234"
        value={typed}
        onChangeText={setTyped}
      />
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  row: { gap: 4 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: Colors.darkGrey },
  value: {
    fontSize: 13,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
