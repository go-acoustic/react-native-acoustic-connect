import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { DemoCard } from '../components/DemoCard'
import { AccessibilityMaskCard } from '../components/AccessibilityMaskCard'
import { CaptureControlCard } from '../components/CaptureControlCard'
import { CustomEventCard } from '../components/CustomEventCard'
import { IdentityDefaultsCard } from '../components/IdentityDefaultsCard'
import { LogoHeader } from '../components/LogoHeader'
import { MaskedFieldCard } from '../components/MaskedFieldCard'
import { NestedSignalCard } from '../components/NestedSignalCard'
import { ReplayModalCard } from '../components/ReplayModalCard'
import { TicketCard } from '../components/TicketCard'
import { SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'
import { TICKETS } from '../verification/tickets'

/**
 * Behaviour tab — the analytics half of the SDK, and the verification surface
 * for the fixes listed in `verification/tickets.ts`.
 *
 * It is the root of a stack rather than a plain screen, because two of the
 * checks need somewhere to navigate to: the screen-view cases need real
 * navigation events to fire the SDK's screenview logging at all, and the
 * WebView check needs a full screen to host the form.
 *
 * Each card states what to do and what a fixed build produces. Two of them
 * carry a "fix not published" banner — those are baselines, not tests, and the
 * banner is there so a quiet run is not mistaken for a pass.
 */
export function BehaviourScreen() {
  const navigation = useNavigation<any>()

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Behaviour Demo" />

      <DemoCard title="What this tab is">
        <Text style={styles.body}>
          Each card below verifies one shipped fix. Drive it on a device, then
          read the posted message — on Android the SDK posts on a ~30s
          foreground timer, on iOS only when the app is backgrounded.
        </Text>
        <Text style={styles.body}>
          A card marked "baseline only" cannot pass yet: the fix exists in
          source but no published native artifact carries it. Run it anyway —
          that record is what makes the re-run after publication meaningful.
        </Text>
      </DemoCard>

      <TicketCard ticket={TICKETS['CA-155041']}>
        <SecondaryButton
          testID="btn_open_screen_views"
          title="Open Screen Views"
          onPress={() => navigation.navigate('ScreenViews')}
        />
      </TicketCard>

      <CustomEventCard />

      <NestedSignalCard />

      <IdentityDefaultsCard />

      <MaskedFieldCard />

      <AccessibilityMaskCard />

      <CaptureControlCard />

      <TicketCard ticket={TICKETS['CA-156499']}>
        <SecondaryButton
          testID="btn_open_webview_post"
          title="Open WebView form POST"
          onPress={() => navigation.navigate('WebViewPost')}
        />
      </TicketCard>

      <TicketCard ticket={TICKETS['CA-152632']}>
        <Text style={styles.body}>
          The two modal cards below present React Native's core {'`<Modal>`'},
          which renders outside the navigator hierarchy — the case that produced
          an empty control tree.
        </Text>
      </TicketCard>

      <ReplayModalCard />
      <ReplayModalCard transparent />

      <TicketCard ticket={TICKETS['CA-137818']}>
        <View style={styles.passBox}>
          <Text style={styles.passText}>
            Verified by this build existing — a broken compile classpath fails
            the Android build outright.
          </Text>
        </View>
      </TicketCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  passBox: {
    backgroundColor: Colors.lightGrey,
    borderLeftColor: Colors.acousticGreen,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
  },
  passText: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
