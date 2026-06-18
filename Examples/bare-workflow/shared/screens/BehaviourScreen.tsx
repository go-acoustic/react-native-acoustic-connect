import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { DemoCard } from '../components/DemoCard'
import { LogoHeader } from '../components/LogoHeader'
import { Colors } from '../theme/colors'

/**
 * Behaviour tab — placeholder kept intentionally empty so the
 * scaffold is in place for the next pass. Slated to host the analytics-side
 * SDK references (`logCustomEvent`, `logSignal`, `logClickEvent`, screen
 * view tracking, exception reporting). Adding new cards here is the
 * canonical way to demo the rest of the SDK's surface.
 */
export function BehaviourScreen() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Behaviour Demo" />
      <DemoCard title="Coming Soon">
        <View style={styles.placeholderBody}>
          <Text style={styles.headline}>
            Analytics surfaces will land here.
          </Text>
          <Text style={styles.body}>
            This tab is intentionally empty for now. Future work will add
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
