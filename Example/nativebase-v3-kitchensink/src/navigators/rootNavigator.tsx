import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Examples, MasonLayout } from '../screens';

const Stack = createStackNavigator();

export function RootStack() {
 // for(let i = 0; i< 10000000000; i++){}
  return (
    <Stack.Navigator initialRouteName="Kitchensink | NativeBase">
      <Stack.Screen
        name="Component | NativeBase"
        component={Examples}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Kitchensink | NativeBase"
        component={MasonLayout}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
