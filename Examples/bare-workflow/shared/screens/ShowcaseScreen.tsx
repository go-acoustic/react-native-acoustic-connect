import React from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { CaptureControlCard } from '../components/CaptureControlCard'
import { ClickCaptureCard } from '../components/ClickCaptureCard'
import { CustomEventBody } from '../components/CustomEventCard'
import { DemoCard } from '../components/DemoCard'
import { DialogCard } from '../components/DialogCard'
import { ExceptionCard } from '../components/ExceptionCard'
import { LogoHeader } from '../components/LogoHeader'
import { NestedSignalCard } from '../components/NestedSignalCard'
import { ReplayModalCard } from '../components/ReplayModalCard'
import { TextCaptureCard } from '../components/TextCaptureCard'
import { PrimaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'

/**
 * Showcase screen — the general-purpose demo of the SDK's behaviour capture,
 * written for someone integrating it for the first time. Reached from the
 * Behaviour hub.
 *
 * Ordering follows what an integrator meets first: the things `<Connect>`
 * captures with no code (screen views, taps, text), then the explicit logging
 * calls (custom events, signals, exceptions), then dialogs and modals, and
 * finally runtime control.
 *
 * Cards that also serve a verification scenario share their body with
 * `VerificationScreen` — the body is the demo, the frame is per screen.
 */
export function ShowcaseScreen() {
  const navigation = useNavigation<any>()

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Showcase" />

      <DemoCard title="How to read the results">
        <Text style={styles.body}>
          Every card sends something to the collector configured in
          ConnectConfig.json. Drive a card, then read the posted message there.
          Android posts on a foreground timer of about 30 seconds; iOS posts
          when the app is backgrounded.
        </Text>
        <Text style={styles.body}>
          The first three cards need no SDK call at all — wrapping the
          navigation tree in {'`<Connect>`'} is what captures them.
        </Text>
      </DemoCard>

      <DemoCard title="Screen views">
        <Text style={styles.body}>
          Every navigation inside {'`<Connect>`'} logs a screen view. The name
          is the route's {'`params.name`'}, falling back to the route name, and
          the referrer is the screen you came from.
        </Text>
        <PrimaryButton
          testID="btn_showcase_open_detail"
          title="Open a detail screen"
          onPress={() =>
            navigation.navigate('ShowcaseDetail', {
              name: 'Showcase detail',
              depth: 1,
            })
          }
        />
      </DemoCard>

      <ClickCaptureCard />

      <TextCaptureCard />

      <DemoCard title="Custom event">
        <Text style={styles.body}>
          {'`logCustomEvent(name, values, level)`'} sends a named event with a
          flat map of string, number and boolean values. Read it under
          {' `customEvent`'} in the posted message.
        </Text>
        <CustomEventBody />
      </DemoCard>

      <NestedSignalCard />

      <ExceptionCard />

      <DialogCard />

      <ReplayModalCard />

      <CaptureControlCard />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
})
