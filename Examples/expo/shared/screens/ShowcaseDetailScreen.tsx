import React from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { DemoCard } from '../components/DemoCard'
import { PrimaryButton, SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'

/**
 * The screen the Showcase's "Screen views" card navigates to. Arriving here is
 * the demo: `<Connect>` has just read `params.name` off this route and logged a
 * screen view with that name, with the previous screen as referrer. Nothing on
 * this screen calls the SDK.
 *
 * "Push another" stacks a second copy with a different name, so a reader can
 * see the referrer chain advance and confirm the leaf route's name is what gets
 * logged rather than a joined path. The chain is capped: a few levels show the
 * behaviour, and an unbounded stack is only a way to run out of memory.
 */

const MAX_DEPTH = 5

export function ShowcaseDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { name = 'Showcase detail', depth = 1 } = (route.params ?? {}) as {
    name?: string
    depth?: number
  }

  const atCap = depth >= MAX_DEPTH

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <DemoCard title="Screen view logged">
        <Text style={styles.body}>
          Opening this screen logged a screen view named:
        </Text>
        <Text style={styles.mono}>{name}</Text>
        <Text style={styles.body}>
          The referrer is the screen you navigated from. Going back logs the
          previous screen again, with this one as its referrer.
        </Text>
      </DemoCard>

      <DemoCard title="Referrer chain">
        <Text style={styles.body}>
          Push another detail screen to see the chain advance by one, then pop
          back through it. Depth {depth} of {MAX_DEPTH}.
        </Text>
        <PrimaryButton
          testID="btn_showcase_push_detail"
          title={atCap ? 'Chain limit reached' : 'Push another'}
          disabled={atCap}
          onPress={() => {
            if (atCap) {
              return
            }
            navigation.push('ShowcaseDetail', {
              name: `Showcase detail ${depth + 1}`,
              depth: depth + 1,
            })
          }}
        />
        <SecondaryButton
          testID="btn_showcase_back"
          title="Back"
          onPress={() => navigation.goBack()}
        />
      </DemoCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingVertical: 20, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  mono: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
})
