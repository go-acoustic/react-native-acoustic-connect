import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { Tabs } from 'expo-router'
import { Colors } from '@shared/theme/colors'

/**
 * Bottom-tab layout — the expo-router equivalent of the bare-workflow demo's
 * `RootNavigator.tsx`. Same three tabs, same brand colors, same emoji icons, so
 * the two apps are visually identical. The `<Connect>` analytics wrapper lives
 * one level up in `_layout.tsx` (it must sit above the navigation container).
 */
type TabIconProps = { icon: string; focused: boolean }

function TabIcon({ icon, focused }: TabIconProps) {
  return (
    <Text
      style={[
        styles.tabIcon,
        { color: focused ? Colors.periwinkle : Colors.middleGrey },
      ]}
    >
      {icon}
    </Text>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.violet, fontWeight: '700' },
        headerShadowVisible: false,
        tabBarActiveTintColor: Colors.periwinkle,
        tabBarInactiveTintColor: Colors.middleGrey,
        tabBarStyle: { backgroundColor: Colors.white },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Push',
          tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="identity"
        options={{
          title: 'Identity',
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="behaviour"
        options={{
          title: 'Behaviour',
          tabBarIcon: ({ focused }) => <TabIcon icon="📈" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 18 },
})
