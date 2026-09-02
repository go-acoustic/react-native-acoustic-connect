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
import {
  ScreenViewsScreen,
  type BehaviourStackParamList,
} from '@shared/screens/ScreenViewsScreen'
import { ScreenViewCaseScreen } from '@shared/screens/ScreenViewCaseScreen'
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
 * The Behaviour tab is a stack, not a single screen. Two of its checks need
 * somewhere to navigate to: the screen-view cases only fire the SDK's
 * screenview logging on a real navigation event, and the WebView form needs a
 * full screen. Pushing and popping is itself part of what the screenview cards
 * measure, so the stack is load-bearing rather than cosmetic.
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
      <BehaviourStack.Screen
        name="ScreenViews"
        component={ScreenViewsScreen}
        // `params.name` is what the SDK reads as the screen name, so seeding it
        // keeps this route's screenviews readable instead of the raw route id.
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
 * `useNavigationContainerRef()` is the recommended way to give Connect a
 * stable handle on the navigation tree — see Connect.tsx JSDoc. Without
 * this wrapper, only the native side's auto-instrumentation (initial
 * screen layout) reaches the collector; RN-side tab switches, taps, and
 * text edits stay silent.
 */
export function RootNavigator() {
  const navigationRef = useNavigationContainerRef()
  return (
    <Connect captureKeyboardEvents navigationRef={navigationRef}>
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
