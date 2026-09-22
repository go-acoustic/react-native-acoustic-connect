import React from 'react'
import { Stack } from 'expo-router'
import { ALL_CASES } from '@shared/screens/screenViewCases'
import { Colors } from '@shared/theme/colors'

/**
 * Behaviour tab — a nested stack, the expo-router equivalent of
 * `BehaviourNavigator` in the bare-workflow sample. Route names match that
 * navigator's so the shared screens' `navigation.navigate('Showcase')` etc.
 * resolve identically in both apps.
 *
 * `initialParams.name` is what the SDK reads as the screen name, so the hub
 * destinations seed it to keep their screen views readable.
 *
 * The WebView POST verification route is not registered here: this app does
 * not depend on react-native-webview. `VerificationScreen` reads the
 * navigator's registered route names and shows an "unavailable" note in place
 * of the button when the route is absent.
 */
export default function BehaviourLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.violet, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: Colors.periwinkle,
      }}
    >
      <Stack.Screen
        name="index"
        initialParams={{ name: 'Behaviour' }}
        options={{ title: 'Behaviour' }}
      />
      <Stack.Screen
        name="Showcase"
        initialParams={{ name: 'Showcase' }}
        options={{ title: 'Showcase' }}
      />
      <Stack.Screen
        name="Verification"
        initialParams={{ name: 'Verification' }}
        options={{ title: 'Verification' }}
      />
      <Stack.Screen
        name="ShowcaseDetail"
        options={({ route }) => ({
          title: (route.params as { name?: string })?.name ?? 'Detail',
        })}
      />
      <Stack.Screen
        name="ScreenViews"
        initialParams={{ name: 'Screen Views' }}
        options={{ title: 'Screen Views' }}
      />
      <Stack.Screen
        name="Case"
        options={({ route }) => ({
          title:
            ALL_CASES.find(
              (entry) =>
                entry.id === (route.params as { caseId?: string })?.caseId
            )?.label ?? 'Screen view',
        })}
      />
    </Stack>
  )
}
