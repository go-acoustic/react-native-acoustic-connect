import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { DemoCard } from './DemoCard'
import { DemoTextField } from './DemoTextField'
import { Colors } from '../theme/colors'

/**
 * Text capture and masking demo.
 *
 * With `captureKeyboardEvents` set on `<Connect>`, edits to any TextInput are
 * logged as text-change events and the field's value is part of the captured
 * screen layout. Values matching a `MaskValueList` rule in ConnectConfig.json
 * arrive masked — the sample config ships a rule for values starting with
 * `SECRET-`, which the second field is there to hit.
 */
export function TextCaptureCard() {
  const [note, setNote] = useState('')
  const [secret, setSecret] = useState('')

  return (
    <DemoCard title="Text entry and masking">
      <Text style={styles.body}>
        Typing into a field logs a text-change event and the value appears in
        the captured layout. A value matching a masking rule in
        ConnectConfig.json is redacted before it leaves the device.
      </Text>
      <DemoTextField
        testID="field_showcase_note"
        label="Plain field"
        placeholder="Anything you type is captured"
        value={note}
        onChangeText={setNote}
      />
      <DemoTextField
        testID="field_showcase_secret"
        label="Masked field"
        placeholder="SECRET-1234"
        value={secret}
        onChangeText={setSecret}
      />
      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          The sample config masks values starting with `SECRET-`: capitals
          become X, lowercase x, digits 9. Compare the two fields in the posted
          layout message.
        </Text>
      </View>
    </DemoCard>
  )
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  hintBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
  },
  hint: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
