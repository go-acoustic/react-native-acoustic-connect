import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScenarioCard } from './ScenarioCard'
import { DemoTextField } from './DemoTextField'
import { Colors } from '../theme/colors'
import { SCENARIOS } from '../verification/scenarios'

/**
 * Verifies that masking reaches the captured accessibility object.
 *
 * The bug: masking redacted an element's **value**, but the SDK serialised the
 * accessibility object — `id`, `label`, `hint` — verbatim, so text a mask list
 * was configured to redact still travelled in `accessibility.label`. React
 * Native made it acute, because RN derives `accessibilityLabel` from a Text
 * node's own content when no explicit label is set: it applied to any masked
 * text without an explicit label, which is the default case.
 *
 * No configuration could close it. `MaskAccessibilityIdList` and
 * `MaskAccessibilityLabelList` are *selectors* — they decide which elements are
 * masked, and the redaction lands on the value. Nothing rewrote the
 * accessibility object.
 *
 * All three rows below used to be worth comparing, because only row 2 kept the
 * payload clean and it did so by silencing the screen reader. Now the label and
 * hint are masked by the same decision that masks the value, so all three are
 * clean and the interesting comparison is gone — which is the point. Row 1 is
 * the one that regressing would break first: it carries no explicit label, so
 * its label is the node's own content.
 *
 * The address matches the `MaskValueList` email pattern in each sample's
 * ConnectConfig.example.json, under `GlobalScreenSettings` — that rule is what
 * makes the element masked in the first place. Without it nothing here is
 * masked and every row looks like a leak, so check the config before reading a
 * failure.
 */

const ADDRESS = 'analyticsp2@test.com'

export function AccessibilityMaskCard() {
  const [typed, setTyped] = useState('')

  return (
    <ScenarioCard scenario={SCENARIOS['accessibility-label-masking']}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>1 · no explicit label</Text>
        {/* RN fills accessibilityLabel from the text content, so this row's
            label IS the address. It is what used to leak. */}
        <Text testID="a11y_implicit" style={styles.value}>
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>2 · explicit label</Text>
        {/* The old workaround. Still clean, and no longer the only clean
            option — so it is no longer worth the mute screen reader. */}
        <Text
          testID="a11y_explicit"
          accessibilityLabel="Email address"
          style={styles.value}
        >
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>3 · label + accessibilityValue</Text>
        {/* Android folds accessibilityValue into contentDescription, which is
            the field the SDK reads as the label — so this used to leak too,
            despite looking like the fix. */}
        <Text
          testID="a11y_value"
          accessibilityLabel="Email address"
          accessibilityValue={{ text: ADDRESS }}
          style={styles.value}
        >
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          In each row's `accessibility` object the label should be masked per
          the config's Sensitive rules — lowercase to x, digits to 9, symbols to
          # — or absent entirely under a standard (non-custom) mask, which
          empties the string and drops the key. `accessibility.id` stays
          readable on purpose.
        </Text>
      </View>

      <DemoTextField
        testID="a11y_field"
        label="Masked input (for comparison)"
        placeholder="SECRET-1234"
        value={typed}
        onChangeText={setTyped}
      />
    </ScenarioCard>
  )
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: Colors.darkGrey },
  value: {
    fontSize: 13,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
  hintBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
