import React, { useRef, useState } from 'react'
import { Platform, StyleSheet, Text, type TextInput } from 'react-native'
import { ScenarioCard } from './ScenarioCard'
import { DemoTextField } from './DemoTextField'
import { SecondaryButton } from './buttons'
import { Colors } from '../theme/colors'
import { SCENARIOS } from '../verification/scenarios'

/**
 * Counts the first field's focus, blur and end-of-editing events, so a lost
 * React Native focus listener shows on screen: what stops is the app's own
 * event props, not a kind of message the SDK posts.
 *
 * The bug needs a direct tap on the field: focus moved by `focus()` alone
 * never reaches the bridge's tap handler. The samples do not move the screen
 * up when the keyboard opens, and it can cover this card: hide it before each
 * tap. The card sits first, so its controls stay clear of the tab bar.
 */
export function FocusEventsCard() {
  const [focus, setFocus] = useState(0)
  const [blur, setBlur] = useState(0)
  const [endEditing, setEndEditing] = useState(0)
  const [probe, setProbe] = useState('')
  const [other, setOther] = useState('')
  const otherField = useRef<TextInput>(null)

  return (
    <ScenarioCard scenario={SCENARIOS['textinput-focus-events']}>
      <Text testID="txt_focus_events" style={styles.mono}>
        {`focus ${focus}, blur ${blur}, end editing ${endEditing}`}
      </Text>
      <SecondaryButton
        testID="btn_focus_other"
        title="Focus the other field"
        onPress={() => otherField.current?.focus()}
      />
      <DemoTextField
        testID="focus_probe_field"
        label="Field under test"
        placeholder="Tap here"
        value={probe}
        onChangeText={setProbe}
        onFocus={() => setFocus((n) => n + 1)}
        onBlur={() => setBlur((n) => n + 1)}
        onEndEditing={() => setEndEditing((n) => n + 1)}
      />
      <DemoTextField
        ref={otherField}
        testID="focus_other_field"
        label="Other field"
        placeholder="The button focuses this field"
        value={other}
        onChangeText={setOther}
      />
    </ScenarioCard>
  )
}

const styles = StyleSheet.create({
  mono: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    color: Colors.violet,
  },
})
