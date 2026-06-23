import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../theme/colors'

type StatusRowProps = {
  label: string
  value: string
  indicatorColor: string
}

/**
 * Colored dot + label + bold value row. RN port of the iOS sample's
 * `StatusRow` (`Scenes/PushDemo/Components/StatusRow.swift`).
 */
export function StatusRow({ label, value, indicatorColor }: StatusRowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: indicatorColor }]} />
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  label: { fontSize: 14, color: Colors.darkGrey },
  value: { fontSize: 14, fontWeight: '700', color: Colors.darkGrey },
})
