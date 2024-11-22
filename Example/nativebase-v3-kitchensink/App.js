import React from 'react';
import { NativeBaseProvider } from 'native-base';
import { BaseTheme } from './src/theme';
import config from './nativebase.config';
import { Root } from './src/components/RootComponent';
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['MasonaryLayout','Examples','Example','AvatarGroup','memoizedProps','ExpoLinearGradient','RCT','VirtualizedLists','aria-label for accessibility']); // Ignore log notification by message

export default function App() {
  return (
    <NativeBaseProvider theme={BaseTheme} config={config}>
      <Root />
    </NativeBaseProvider>
  );
}
