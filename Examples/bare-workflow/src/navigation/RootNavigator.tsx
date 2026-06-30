import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { Connect } from 'react-native-acoustic-connect'
import { BehaviourScreen } from '@shared/screens/BehaviourScreen'
import { IdentityScreen } from '@shared/screens/IdentityScreen'
import { PushScreen } from '@shared/screens/PushScreen'
import { Colors } from '@shared/theme/colors'

export type TabParamList = {
  Push: undefined
  Identity: undefined
  Behaviour: undefined
}

const Tabs = createBottomTabNavigator<TabParamList>()

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
            options={{ title: 'Push' }}
          />
          <Tabs.Screen
            name="Identity"
            component={IdentityScreen}
            options={{ title: 'Identity' }}
          />
          <Tabs.Screen
            name="Behaviour"
            component={BehaviourScreen}
            options={{ title: 'Behaviour' }}
          />
        </Tabs.Navigator>
      </NavigationContainer>
    </Connect>
  )
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 18 },
})
