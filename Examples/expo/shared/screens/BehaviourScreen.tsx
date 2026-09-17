import React from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { DemoCard } from '../components/DemoCard'
import { LogoHeader } from '../components/LogoHeader'
import { PrimaryButton, SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'

/**
 * Behaviour tab root — a hub with two entry points into the analytics half of
 * the SDK.
 *
 * - **Showcase** is the general-purpose demo: one card per capture feature,
 *   written for someone integrating the SDK for the first time.
 * - **Verification** is the release-verification surface: one card per shipped
 *   fix, each stating what to do and what a fixed build produces.
 *
 * Both live in the same stack because several cards need somewhere to
 * navigate to — screen-view logging only fires on a real navigation event.
 */
export function BehaviourScreen() {
  const navigation = useNavigation<any>()

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <LogoHeader title="Behaviour" />

      <DemoCard title="Showcase">
        <Text style={styles.body}>
          What the SDK captures once your app is wrapped in {'`<Connect>`'}:
          screen views, taps, text entry, custom events, signals, dialogs,
          exceptions and session replay of modals. One card per feature, each
          with the call it makes and where to read the result.
        </Text>
        <PrimaryButton
          testID="btn_open_showcase"
          title="Open Showcase"
          onPress={() => navigation.navigate('Showcase')}
        />
      </DemoCard>

      <DemoCard title="Verification">
        <Text style={styles.body}>
          Release-verification checks. Each card verifies one shipped fix
          against the SDK build this app is running, with the steps to follow
          and the payload to expect. Intended for regression runs rather than as
          an integration reference.
        </Text>
        <SecondaryButton
          testID="btn_open_verification"
          title="Open Verification"
          onPress={() => navigation.navigate('Verification')}
        />
      </DemoCard>

      <Text style={styles.footnote}>
        Both screens post to the collector configured in ConnectConfig.json.
        Android posts on a foreground timer of about 30 seconds; iOS posts when
        the app is backgrounded.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.darkGrey,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
})
