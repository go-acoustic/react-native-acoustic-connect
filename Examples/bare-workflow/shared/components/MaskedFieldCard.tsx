import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScenarioCard } from './ScenarioCard'
import { DemoTextField } from './DemoTextField'
import { Colors } from '../theme/colors'
import { SCENARIOS } from '../verification/scenarios'

/**
 * Verifies that the layout config in ConnectConfig.json actually reaches the
 * SDK.
 *
 * Masking is the observable proxy. The config ships a `MaskValueList` regex for
 * `SECRET-…`, so if the block is applied the typed value arrives masked in the
 * posted layout message, and if the block is ignored it arrives verbatim. That
 * makes a config-plumbing bug visible on the wire, which is the only place it
 * ever showed: nothing in the app's behaviour changes when the config is
 * silently dropped.
 *
 * Requires the `layoutConfigIos` / `layoutConfigAndroid` block in
 * ConnectConfig.json — without it there is no masking rule and the check is
 * vacuous rather than failing.
 */
export function MaskedFieldCard() {
  const [value, setValue] = useState('')

  return (
    <ScenarioCard scenario={SCENARIOS['layout-config-applied']}>
      <DemoTextField
        testID="field_masked"
        label="Masked field"
        placeholder="SECRET-1234"
        value={value}
        onChangeText={setValue}
      />
      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          Type a value starting with `SECRET-`, then background the app (iOS) or
          wait for the next post (Android). In the layout message the value
          should be masked per the config's Sensitive rules — capitals to X,
          lowercase to x, digits to 9 — not the text you typed.
        </Text>
      </View>
    </ScenarioCard>
  )
}

const styles = StyleSheet.create({
  hintBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
