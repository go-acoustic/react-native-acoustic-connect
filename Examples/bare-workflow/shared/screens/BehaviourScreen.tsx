import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { DemoCard } from '../components/DemoCard'
import { LogoHeader } from '../components/LogoHeader'
import { ReplayModalCard } from '../components/ReplayModalCard'
import { Colors } from '../theme/colors'

/**
 * Behaviour tab — hosts the analytics-side SDK references. The modal cards
 * cover session-replay capture of React Native's core `<Modal>`, which
 * presents outside the navigator hierarchy and so exercises a distinct
 * layout-capture path from the tab screens. Still slated to grow
 * `logCustomEvent`, `logSignal`, `logClickEvent`, screen view tracking, and
 * exception reporting; adding new cards here is the canonical way to demo
 * the rest of the SDK's surface.
 */
export function BehaviourScreen() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Behaviour Demo" />
      <ReplayModalCard />
      <ReplayModalCard transparent />
      <DemoCard title="Coming Soon">
        <View style={styles.placeholderBody}>
          <Text style={styles.headline}>
            Analytics surfaces will land here.
          </Text>
          <Text style={styles.body}>
            The modal cards above are the first of these. Future work will add
            demo cards for custom events, signals, click and text-change
            tracking, screen-view logging, and unhandled-exception reporting —
            the analytics half of the SDK that lives alongside the push half.
          </Text>
        </View>
      </DemoCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  placeholderBody: { gap: 8 },
  headline: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.violet,
  },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
})
