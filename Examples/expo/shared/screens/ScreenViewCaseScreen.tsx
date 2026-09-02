import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { DemoCard } from '../components/DemoCard'
import { describeName } from '../components/DirectScreenViewCard'
import { PrimaryButton, SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'
import { ALL_CASES, NAV_CASES } from './screenViewCases'

/**
 * The pushed screen for one screen-name case. Arriving here is the event under
 * test: `<Connect>`'s navigation listener has just read `params.name` off this
 * route and handed it to the native SDK as the logical page name, so a type-2
 * message with that exact name is already on its way to the collector.
 *
 * The screen then shows the name it was entered with, so a tester can match
 * what the app claims to have logged against what the collector received and
 * what the inferred signal's `url` ends up being — three places the value has
 * to agree.
 *
 * Pushing a further case from here builds a deeper stack, which checks that the
 * leaf route's name is what gets logged rather than a joined path.
 */
export function ScreenViewCaseScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { name, caseId } = (route.params ?? {}) as {
    name?: string
    caseId?: string
  }
  const [relogged, setRelogged] = useState<string | null>(null)

  const testCase = ALL_CASES.find((entry) => entry.id === caseId)

  const relog = useCallback(() => {
    const ok = AcousticConnectRN.logScreenViewContextLoad(
      name ?? '',
      'Screen Views'
    )
    setRelogged(`${ok ? '✓' : '✗'} re-logged directly`)
  }, [name])

  const next = NAV_CASES.find((entry) => entry.id !== caseId)

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <DemoCard title="Logged screen name">
        <Text style={styles.mono}>{describeName(name ?? null)}</Text>
        <Text style={styles.meta}>
          {name?.length ?? 0} characters · route param `name`
        </Text>
        {testCase ? <Text style={styles.body}>{testCase.probes}</Text> : null}
      </DemoCard>

      <DemoCard title="Expected result">
        <Text style={styles.body}>
          The type-2 message should carry `screenview.name` exactly as shown
          above, and the inferred `pageView` signal should carry the same string
          as `signalContent.url` — valid, not in the invalid-signal topic.
        </Text>
      </DemoCard>

      <DemoCard title="Repeat">
        <Text style={styles.body}>
          Re-send the same name through the direct bridge call, to compare the
          navigation-driven message against an explicit one.
        </Text>
        <PrimaryButton
          testID="btn_case_relog"
          title="Log this name directly"
          onPress={relog}
        />
        {relogged ? (
          <Text testID="txt_case_relog_result" style={styles.mono}>
            {relogged}
          </Text>
        ) : null}
        {next ? (
          <>
            <View style={styles.spacer} />
            <SecondaryButton
              testID="btn_case_push_next"
              title={`Push deeper — ${next.label}`}
              onPress={() =>
                navigation.push('Case', {
                  name: next.name as string,
                  caseId: next.id,
                })
              }
            />
          </>
        ) : null}
      </DemoCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingVertical: 20, gap: 20 },
  body: { fontSize: 13, lineHeight: 19, color: Colors.darkGrey },
  meta: { fontSize: 11, color: Colors.darkGrey },
  mono: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
  spacer: { height: 4 },
})
