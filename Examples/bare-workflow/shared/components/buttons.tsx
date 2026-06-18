import React from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Colors } from '../theme/colors'

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string
  style?: StyleProp<ViewStyle>
}

/**
 * Mirrors `PrimaryButtonStyle` in the iOS sample
 * (`Scenes/PushDemo/Components/DemoButtonStyles.swift`): periwinkle fill,
 * white bold text, fades on press, opaque-grey when disabled.
 */
export function PrimaryButton({
  title,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        pressed && !disabled && styles.primaryPressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  )
}

/**
 * Mirrors `SecondaryButtonStyle` (dark-grey fill).
 */
export function SecondaryButton({
  title,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        pressed && !disabled && styles.secondaryPressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primary: { backgroundColor: Colors.periwinkle },
  primaryPressed: { backgroundColor: Colors.periwinkle, opacity: 0.75 },
  secondary: { backgroundColor: Colors.darkGrey },
  secondaryPressed: { backgroundColor: Colors.darkGrey, opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
})
