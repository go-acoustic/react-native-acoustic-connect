import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { Connect } from 'react-native-acoustic-connect-beta'
import { BehaviourScreen } from '@shared/screens/BehaviourScreen'
import { IdentityScreen } from '@shared/screens/IdentityScreen'
import { PushScreen } from '@shared/screens/PushScreen'
import { ScreenViewsScreen } from '@shared/screens/ScreenViewsScreen'
import type { BehaviourStackParamList } from '@shared/screens/behaviourRoutes'
import { ScreenViewCaseScreen } from '@shared/screens/ScreenViewCaseScreen'
import { ShowcaseDetailScreen } from '@shared/screens/ShowcaseDetailScreen'
import { ShowcaseScreen } from '@shared/screens/ShowcaseScreen'
import { VerificationScreen } from '@shared/screens/VerificationScreen'
import { WebViewPostScreen } from '@shared/screens/WebViewPostScreen'
import { ALL_CASES } from '@shared/screens/screenViewCases'
import { Colors } from '@shared/theme/colors'

export type TabParamList = {
  Push: undefined
  Identity: undefined
  Behaviour: undefined
}

const Tabs = createBottomTabNavigator<TabParamList>()
const BehaviourStack = createNativeStackNavigator<BehaviourStackParamList>()

/**
 * The Behaviour tab is a stack, not a single screen. Its root is a hub with two
 * entry points — Showcase (general demo) and Verification (regression checks)
 * — and several cards need somewhere to navigate to: screen-view logging only
 * fires on a real navigation event, and the WebView form needs a full screen.
 * Pushing and popping is itself part of what the screen-view cards show, so
 * the stack is load-bearing rather than cosmetic.
 */
function BehaviourNavigator() {
  return (
    <BehaviourStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.violet, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: Colors.periwinkle,
      }}
    >
      <BehaviourStack.Screen
        name="Behaviour"
        component={BehaviourScreen}
        options={{ title: 'Behaviour' }}
      />
      {/* `params.name` is what the SDK reads as the screen name, so the two
          hub destinations seed it to keep their screen views readable. */}
      <BehaviourStack.Screen
        name="Showcase"
        component={ShowcaseScreen}
        initialParams={{ name: 'Showcase' }}
        options={{ title: 'Showcase' }}
      />
      <BehaviourStack.Screen
        name="Verification"
        component={VerificationScreen}
        initialParams={{ name: 'Verification' }}
        options={{ title: 'Verification' }}
      />
      <BehaviourStack.Screen
        name="ShowcaseDetail"
        component={ShowcaseDetailScreen}
        options={({ route }) => ({ title: route.params?.name ?? 'Detail' })}
      />
      <BehaviourStack.Screen
        name="ScreenViews"
        component={ScreenViewsScreen}
        initialParams={{ name: 'Screen Views' }}
        options={{ title: 'Screen Views' }}
      />
      <BehaviourStack.Screen
        name="Case"
        component={ScreenViewCaseScreen}
        // Title comes from the case label, never the logged name — a 300-char
        // or emoji name would make the header unreadable while telling us
        // nothing extra, since the screen body prints the logged value.
        options={({ route }) => ({
          title:
            ALL_CASES.find((entry) => entry.id === route.params?.caseId)
              ?.label ?? 'Screen view',
        })}
      />
      <BehaviourStack.Screen
        name="WebViewPost"
        component={WebViewPostScreen}
        options={{ title: 'WebView POST' }}
      />
    </BehaviourStack.Navigator>
  )
}

type TabRouteName = keyof TabParamList

const TAB_ICONS: Record<TabRouteName, string> = {
  Push: '🔔',
  Identity: '👤',
  Behaviour: '📈',
}

type TabIconProps = { name: TabRouteName; focused: boolean }

function TabIcon({ name, focused }: TabIconProps) {
  return (
    <Text
      style={[
        styles.tabIcon,
        { color: focused ? Colors.periwinkle : Colors.middleGrey },
      ]}
    >
      {TAB_ICONS[name]}
    </Text>
  )
}

/**
 * The SDK's `<Connect>` component is the canonical RN integration: it
 * wraps the navigation tree, observes `state` events to log screen-view
 * and screen-layout signals, and captures every touch via
 * `onStartShouldSetResponderCapture` so the SDK can record click events.
 *
 * `captureDialogEvents` additionally intercepts `Alert.alert` so dialog
 * show / button / dismiss events are logged — the Showcase's Dialogs card
 * relies on it.
 *
 * `useNavigationContainerRef()` is the recommended way to give Connect a
 * stable handle on the navigation tree — see Connect.tsx JSDoc. Without
 * this wrapper, only the native side's auto-instrumentation (initial
 * screen layout) reaches the collector; RN-side tab switches, taps, and
 * text edits stay silent.
 */
export function RootNavigator() {
  const navigationRef = useNavigationContainerRef()
  return (
    <Connect
      captureKeyboardEvents
      captureDialogEvents
      navigationRef={navigationRef}
    >
      <NavigationContainer ref={navigationRef}>
        <Tabs.Navigator
          screenOptions={({ route }) => ({
            headerStyle: { backgroundColor: Colors.background },
            headerTitleStyle: { color: Colors.violet, fontWeight: '700' },
            headerShadowVisible: false,
            tabBarActiveTintColor: Colors.periwinkle,
            tabBarInactiveTintColor: Colors.middleGrey,
            tabBarStyle: { backgroundColor: Colors.white },
            tabBarIcon: ({ focused }) => (
              <TabIcon name={route.name} focused={focused} />
            ),
          })}
        >
          <Tabs.Screen
            name="Push"
            component={PushScreen}
            options={{ title: 'Push', tabBarButtonTestID: 'tab_notification' }}
          />
          <Tabs.Screen
            name="Identity"
            component={IdentityScreen}
            options={{ title: 'Identity', tabBarButtonTestID: 'tab_identity' }}
          />
          <Tabs.Screen
            name="Behaviour"
            component={BehaviourNavigator}
            options={{
              title: 'Behaviour',
              tabBarButtonTestID: 'tab_behaviour',
              // The nested stack draws its own header; a second one from the
              // tab navigator would stack two title bars.
              headerShown: false,
            }}
          />
        </Tabs.Navigator>
      </NavigationContainer>
    </Connect>
  )
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 18 },
})
