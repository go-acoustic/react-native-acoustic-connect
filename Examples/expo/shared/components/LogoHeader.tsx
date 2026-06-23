import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../theme/colors'

type LogoHeaderProps = {
  title: string
}

/**
 * Logo + page-title block shown at the top of every demo screen. Mirrors the
 * iOS sample's `headerView` (PushDemoView / IdentityDemoView). The iOS app
 * uses an `Image("logo")` asset; the RN demo prints the brand wordmark in
 * violet to keep the example free of binary assets.
 */
export function LogoHeader({ title }: LogoHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.brand}>ACOUSTIC</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 6, paddingTop: 24 },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
    color: Colors.violet,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.violet,
  },
})
