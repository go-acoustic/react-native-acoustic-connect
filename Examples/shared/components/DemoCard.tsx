import React, { type ReactNode } from 'react'
import { StyleSheet, Text, View, Platform } from 'react-native'
import { Colors } from '../theme/colors'

type DemoCardProps = {
  title: string
  children: ReactNode
}

/**
 * Card container with a violet title — RN port of the iOS sample's `DemoCard`
 * (`Scenes/PushDemo/Components/DemoCard.swift`). White surface, 14-radius,
 * subtle violet shadow.
 */
export function DemoCard({ title, children }: DemoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignSelf: 'stretch',
    ...Platform.select({
      ios: {
        shadowColor: Colors.violet,
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.violet,
    marginBottom: 12,
  },
  body: { gap: 14 },
})
