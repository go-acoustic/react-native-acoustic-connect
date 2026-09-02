import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { DemoCard } from '../components/DemoCard'
import {
  DirectScreenViewCard,
  describeName,
} from '../components/DirectScreenViewCard'
import { LogoHeader } from '../components/LogoHeader'
import { SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'
import { NAV_CASES } from './screenViewCases'

/**
 * Screen-view tab — the verification surface for the inferred `pageView`
 * signal's url fallback. BehaviourScreen's roadmap listed
 * screen-view logging as a gap; this fills it.
 *
 * This screen sits in the Behaviour stack, so drilling into a case is a real
 * navigation event: `<Connect>`'s `state` listener fires, reads `params.name`
 * off the incoming route, and forwards it to the native SDK. That is the same
 * code path a customer app takes, which is what makes the result meaningful —
 * a synthetic bridge call alone would not prove the integration produces
 * usable screenview names.
 *
 * The route carries `initialParams={{ name: 'Screen Views' }}` so returning
 * here logs a readable name instead of the raw route id, and so back-navigation
 * produces repeat screenviews of the same name.
 */

export type BehaviourStackParamList = {
  Behaviour: undefined
  ScreenViews: { name: string } | undefined
  Case: { name: string; caseId: string }
  WebViewPost: undefined
}

export function ScreenViewsScreen() {
  const navigation = useNavigation<any>()

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Screen Views" />

      <DemoCard title="How this is verified">
        <Text style={styles.body}>
          Every screen view sends a type-2 message carrying the screen name. The
          platform derives a `pageView` signal from it; because a mobile screen
          has no URL, the server-side rule falls back to that name for the
          signal's `url`.
        </Text>
        <Text style={styles.body}>
          So each button below is one test of that fallback. Drive them, then
          check the subscription's inferred `pageView` definition — valid count
          should rise and the `Missing required field: [url]` records should
          stop.
        </Text>
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            Do not press the Behaviour tab's Log Signal buttons during a run.
            They send an explicit `pageview` signal, and inference stands down
            for a subscription that sends its own — which would read as a pass
            when it is really a suppression.
          </Text>
        </View>
      </DemoCard>

      <DemoCard title="Navigate — real integration path">
        <Text style={styles.body}>
          Pushes a route whose `params.name` the SDK picks up as the screen
          name. Navigate back and re-enter to produce repeat views.
        </Text>
        {NAV_CASES.map((testCase) => (
          <View key={testCase.id} style={styles.caseBlock}>
            <SecondaryButton
              testID={`btn_navigate_${testCase.id}`}
              title={testCase.label}
              onPress={() =>
                navigation.navigate('Case', {
                  // NAV_CASES excludes the null name, so this is always a string.
                  name: testCase.name as string,
                  caseId: testCase.id,
                })
              }
            />
            <Text style={styles.caseName}>
              logs: {describeName(testCase.name)}
            </Text>
          </View>
        ))}
      </DemoCard>

      <DirectScreenViewCard />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  caseBlock: { gap: 6 },
  caseName: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
  warnBox: {
    backgroundColor: Colors.lightGrey,
    borderLeftColor: Colors.periwinkle,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
  },
  warnText: { fontSize: 12, lineHeight: 18, color: Colors.violet },
})
