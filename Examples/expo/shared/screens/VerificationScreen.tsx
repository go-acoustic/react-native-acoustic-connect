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
import { ScenarioCard } from '../components/ScenarioCard'
import { SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'
import { SCENARIOS } from '../verification/scenarios'

/**
 * Verification screen — the release-verification surface for the fixes listed
 * in `verification/scenarios.ts`. Reached from the Behaviour hub.
 *
 * Each card states what to do and what a fixed build produces. Two of them
 * carry a "fix not published" banner — those are baselines, not tests, and the
 * banner is there so a quiet run is not mistaken for a pass.
 *
 * Cards whose body doubles as a general demo (custom event, signal, modal,
 * capture control) share that body with the Showcase screen; only the
 * `ScenarioCard` frame is specific to this screen.
 */
export function VerificationScreen() {
  const navigation = useNavigation<any>()
  // The WebView check needs react-native-webview, which not every host app
  // carries (the Expo sample does not), so its route is optional. Ask the
  // enclosing navigator what it registered instead of assuming.
  const hasWebViewRoute: boolean =
    navigation.getState()?.routeNames?.includes('WebViewPost') ?? false

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Verification" />

      <DemoCard title="What this screen is">
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

      <ScenarioCard scenario={SCENARIOS['screenview-referrer']}>
        <SecondaryButton
          testID="btn_open_screen_views"
          title="Open Screen Views"
          onPress={() => navigation.navigate('ScreenViews')}
        />
      </ScenarioCard>

      <CustomEventCard />

      <NestedSignalCard />

      <IdentityDefaultsCard />

      <MaskedFieldCard />

      <AccessibilityMaskCard />

      <CaptureControlCard />

      <ScenarioCard scenario={SCENARIOS['webview-post-not-replayed-as-get']}>
        {hasWebViewRoute ? (
          <SecondaryButton
            testID="btn_open_webview_post"
            title="Open WebView form POST"
            onPress={() => navigation.navigate('WebViewPost')}
          />
        ) : (
          <View style={styles.noteBox}>
            <Text testID="txt_webview_unavailable" style={styles.noteText}>
              Not available in this app: it does not include
              react-native-webview, so the WebView POST screen is not
              registered. Run this check in the bare-workflow sample.
            </Text>
          </View>
        )}
      </ScenarioCard>

      <ScenarioCard scenario={SCENARIOS['replay-captures-modal']}>
        <Text style={styles.body}>
          The two modal cards below present React Native's core {'`<Modal>`'},
          which renders outside the navigator hierarchy — the case that produced
          an empty control tree.
        </Text>
      </ScenarioCard>

      <ReplayModalCard />
      <ReplayModalCard transparent />

      <ScenarioCard scenario={SCENARIOS['android-compile-classpath']}>
        <View style={styles.passBox}>
          <Text style={styles.passText}>
            Verified by this build existing — a broken compile classpath fails
            the Android build outright.
          </Text>
        </View>
      </ScenarioCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  noteBox: {
    backgroundColor: Colors.lightGrey,
    borderLeftColor: Colors.middleGrey,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
  },
  noteText: { fontSize: 12, lineHeight: 18, color: Colors.darkGrey },
  passBox: {
    backgroundColor: Colors.lightGrey,
    borderLeftColor: Colors.acousticGreen,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
  },
  passText: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
