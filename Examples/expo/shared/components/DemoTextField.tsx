import React from 'react'
import { StyleSheet, Text, TextInput, View, Platform } from 'react-native'
import { Colors } from '../theme/colors'

type DemoTextFieldProps = {
  label: string
  placeholder: string
  value: string
  onChangeText: (text: string) => void
  disabled?: boolean
  testID?: string
}

/**
 * Labeled text input mirroring the iOS sample's `DemoTextField`
 * (`Scenes/PushDemo/Components/DemoTextField.swift`): monospace input,
 * light-grey fill, middle-grey border, violet text.
 */
export function DemoTextField({
  label,
  placeholder,
  value,
  onChangeText,
  disabled = false,
  testID,
}: DemoTextFieldProps) {
  return (
    <View
      testID={testID ? `${testID}_container` : undefined}
      style={styles.wrapper}
    >
      <Text
        testID={testID ? `${testID}_label` : undefined}
        style={[styles.label, disabled && styles.labelDisabled]}
      >
        {label}
      </Text>
      <TextInput
        testID={testID}
        style={[styles.input, disabled && styles.inputDisabled]}
        placeholder={placeholder}
        placeholderTextColor={Colors.middleGrey}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: {
    fontSize: 12,
    color: Colors.darkGrey,
  },
  labelDisabled: { color: Colors.middleGrey },
  input: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 14,
    color: Colors.violet,
    backgroundColor: Colors.lightGrey,
    borderColor: Colors.middleGrey,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  inputDisabled: {
    backgroundColor: Colors.lightGrey,
    color: Colors.middleGrey,
    opacity: 0.5,
  },
})
