/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Modal,
  Button,
  TouchableOpacity,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

// import { AcousticConnectRN } from 'react-native-acoustic-connect';

// import AcousticConnectRN, {
//   type AcousticConnectStatusInfoRNBeta,
// } from 'react-native-acoustic-connect';

const result = 500;
import * as AcousticModule from 'react-native-acoustic-connect';

console.log(AcousticModule); // Inspect all exports from the module

import AcousticConnectRN from 'react-native-acoustic-connect';

console.log('AcousticConnectRN:', AcousticConnectRN);

if (!AcousticConnectRN) {
  console.error('Failed to import AcousticConnectRN');
} else {
  AcousticConnectRN.logCustomEvent('test', { test: 'test' }, 1);
}
// const connect = AcousticConnectRN.getInstance();
// connect.setBooleanConfigItemForKey(true, 'test', 'test');
// connect.setStringItemForKey('test', 'test', 'test');
// connect.setNumberItemForKey(1, 'test', 'test');
// connect.setConfigItemForKey('test', 'test', 'test');
// connect.getBooleanConfigItemForKey(true, 'test', 'test');
// connect.getStringItemForKey('test', 'test', 'test');
// connect.getNumberItemForKey(1, 'test', 'test');
// const test2 = AcousticConnectRN;
// test2.logCustomEvent('test', {test: 'test'}, 1);
// connect.logSignal({test: 'test'}, 1);
// connect.logExceptionEvent('test', 'test', true);
// connect.logLocation();
// connect.logLocationWithLatitudeLongitude(1, 1, 1);
// connect.logClickEvent(1, 'test');
// connect.logTextChangeEvent(1, 'test', 'test');
// connect.setCurrentScreenName('test');
// connect.logScreenViewContextLoad('test', 'test');
// connect.logScreenViewContextUnload('test', 'test');
// connect.logScreenLayout('test', 1);
// connect.setConnectMonitoringLevel('Ignore');
// connect.setConnectMonitoringLevel('CellularAndWiFi');
// connect.setConnectMonitoringLevel('WiFi');
// connect.setConnectMonitoringLevel('test' as ConnectMonitoringLevelType);
function Section({children, title}: SectionProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [modalVisible, setModalVisible] = useState(false);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <Header />
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
          }}>
          <Section title="Step One">
            Edit <Text style={styles.highlight}>App.tsx</Text> to change this
            screen and then come back to see your edits.
          </Section>
          <Section title="Popup Modal">
            <Button title="Show Modal" onPress={() => setModalVisible(true)} />
          </Section>
        </View>
      </ScrollView>

      {/* Modal Component */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>This is a popup modal!</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 18,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default App;