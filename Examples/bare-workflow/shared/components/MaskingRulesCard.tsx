import React, { useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { ScenarioCard } from './ScenarioCard'
import { DemoTextField } from './DemoTextField'
import { PrimaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { SCENARIOS } from '../verification/scenarios'

/**
 * Verifies that value, id and password rules reach every captured surface —
 * the layout text, the ids, the tap target and the screenshot that comes with
 * the tap — not only the accessibility label.
 *
 * The address and the `SECRET-` prefix match `MaskValueList`, and row 3
 * matches the `^mask_rules_card$` id rule, in each sample's
 * ConnectConfig.example.json under `GlobalScreenSettings`. On Android the id
 * rule is in `MaskIdList`, which matches an element's testID; on iOS it is in
 * `MaskAccessibilityIdList`, which matches the accessibility identifier React
 * Native sets from the testID. Without those rules nothing here is masked, so
 * check the config before reading a failure.
 *
 * The email and password fields are filled in from the start, so the layout
 * captured when the screen opens carries their values. Text typed into the
 * last field is not in that layout; the tap on the button carries a
 * screenshot, which is where it must be obscured.
 */

const ADDRESS = 'analyticsp2@test.com'
const PASSWORD = 'sample-pass-42'

export function MaskingRulesCard() {
  const [email, setEmail] = useState(ADDRESS)
  const [password, setPassword] = useState(PASSWORD)
  const [typed, setTyped] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <ScenarioCard scenario={SCENARIOS['masking-value-id-rules']}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>1 · value rule, with a label</Text>
        <Text
          testID="mask_rules_labelled"
          accessibilityLabel="Contact email"
          style={styles.value}
        >
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>2 · value rule, no label</Text>
        <Text testID="mask_rules_unlabelled" style={styles.value}>
          {ADDRESS}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>3 · id rule</Text>
        <Text
          testID="mask_rules_card"
          accessibilityLabel="Card number"
          style={styles.value}
        >
          4111 1111 1111 1111
        </Text>
      </View>

      <DemoTextField
        testID="mask_rules_email_field"
        label="Email field"
        placeholder={ADDRESS}
        value={email}
        onChangeText={setEmail}
      />

      <DemoTextField
        testID="mask_rules_password"
        label="Password"
        placeholder=""
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <DemoTextField
        testID="mask_rules_typed"
        label="Typed value"
        placeholder="SECRET-1234"
        value={typed}
        onChangeText={setTyped}
      />

      <PrimaryButton
        testID="btn_mask_rules_send"
        title={`Send to ${ADDRESS}`}
        onPress={() => setSent(true)}
      />
      {sent ? (
        <Text testID="txt_mask_rules_result" style={styles.mono}>
          Tap sent. Its screenshot should obscure every masked row above, the
          typed one included.
        </Text>
      ) : null}

      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          In the layout message rows 1 and 2 and the email field should read
          xxxxxxxxxx9#xxxx#xxx and row 3 9999 9999 9999 9999. The password field
          should read dots on Android and be masked per the Sensitive rules on
          iOS — never the typed password. Text typed into the last field is not
          in the layout, which is captured when the screen opens; it should be
          obscured in the screenshot that comes with the tap.
        </Text>
      </View>
    </ScenarioCard>
  )
}

// Android has no Courier and silently falls back to sans-serif.
const MONOSPACE = Platform.select({ ios: 'Courier', android: 'monospace' })

const styles = StyleSheet.create({
  row: { gap: 4 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: Colors.darkGrey },
  value: {
    fontSize: 13,
    color: Colors.violet,
    fontFamily: MONOSPACE,
  },
  mono: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: MONOSPACE,
  },
  hintBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
