import React, { useCallback, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { DemoCard } from '../components/DemoCard'
import { DemoTextField } from '../components/DemoTextField'
import { LogoHeader } from '../components/LogoHeader'
import { PrimaryButton } from '../components/buttons'
import { ConnectSDKManager } from '../services/ConnectSDKManager'
import { useManagerState } from '../services/useManagerState'
import { Colors } from '../theme/colors'

/**
 * Identity tab — mirrors `IdentityDemoView` from the iOS sample
 * (`Scenes/IdentityDemo/IdentityDemoView.swift`). Logs a `loggedIn` or
 * `accountRegistered` signal, displays the last result, and surfaces the
 * five most recent identifier pairs so testers can re-fire a known-good
 * combination quickly.
 */
export function IdentityScreen() {
  const state = useManagerState()
  const [identifierName, setIdentifierName] = useState('')
  const [identifierValue, setIdentifierValue] = useState('')

  const canLog = useMemo(
    () => identifierName.trim() !== '' && identifierValue.trim() !== '',
    [identifierName, identifierValue]
  )

  const onLogIn = useCallback(() => {
    ConnectSDKManager.logUserLoggedIn(identifierName, identifierValue)
  }, [identifierName, identifierValue])

  const onRegister = useCallback(() => {
    ConnectSDKManager.logUserRegistered(identifierName, identifierValue)
  }, [identifierName, identifierValue])

  const recents = state.identityHistory.filter(
    (p) => p.name !== '' && p.value !== ''
  )

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <LogoHeader title="Identity Demo" />

      {state.identityLogResult ? (
        <DemoCard title="Last Result">
          <Text style={styles.resultText}>{state.identityLogResult}</Text>
        </DemoCard>
      ) : null}

      <DemoCard title="Log Identity">
        <DemoTextField
          label="Identifier Name"
          placeholder="Email Address"
          value={identifierName}
          onChangeText={setIdentifierName}
        />
        <DemoTextField
          label="Identifier Value"
          placeholder="user@example.com"
          value={identifierValue}
          onChangeText={setIdentifierValue}
        />
        <PrimaryButton
          title="Log Logged In With Email"
          onPress={onLogIn}
          disabled={!canLog}
        />
        <PrimaryButton
          title="Log Account Registered With Email"
          onPress={onRegister}
          disabled={!canLog}
        />
      </DemoCard>

      {recents.length > 0 ? (
        <DemoCard title="Recent">
          <View style={styles.recentList}>
            {recents.map((pair, index) => (
              <View key={pair.name + pair.value}>
                <Pressable
                  onPress={() => {
                    setIdentifierName(pair.name)
                    setIdentifierValue(pair.value)
                  }}
                  style={styles.recentRow}
                >
                  <View style={styles.recentText}>
                    <Text style={styles.recentName}>{pair.name}</Text>
                    <Text style={styles.recentValue}>{pair.value}</Text>
                  </View>
                  <Text style={styles.recentArrow}>↖</Text>
                </Pressable>
                {index < recents.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </View>
            ))}
          </View>
        </DemoCard>
      ) : null}
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
  resultText: { fontSize: 14, color: Colors.darkGrey },
  recentList: { gap: 0 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  recentText: { flex: 1, gap: 2 },
  recentName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.violet,
  },
  recentValue: { fontSize: 12, color: Colors.darkGrey },
  recentArrow: { fontSize: 14, color: Colors.middleGrey },
  divider: {
    height: 1,
    backgroundColor: Colors.lightGrey,
  },
})
