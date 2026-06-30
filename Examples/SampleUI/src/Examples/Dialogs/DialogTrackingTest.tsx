import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';

interface DialogTrackingTestProps {
  visible: boolean;
  close: () => void;
}

const DialogTrackingTest: React.FC<DialogTrackingTestProps> = ({ visible, close }) => {
  // Test Alert.alert tracking (this should work automatically)
  const testAlertTracking = () => {
    console.log('🧪 Testing Alert.alert tracking...');
    Alert.alert(
      'Test Alert',
      'This is a test alert for dialog tracking',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => console.log('✅ OK pressed') }
      ]
    );
  };

  // Test direct native API call
  const testNativeDialogAPI = async () => {
    console.log('🧪 Testing direct native dialog API...');
    try {
      const AcousticConnectRN = require('react-native-acoustic-connect').default;
      console.log('🔍 AcousticConnectRN methods available:', Object.keys(AcousticConnectRN));
      
      if (typeof AcousticConnectRN.logDialogShowEvent === 'function') {
        const result = await AcousticConnectRN.logDialogShowEvent('test-dialog', 'Test Dialog', 'test');
        console.log('Native dialog API result:', result);
        if (result) {
          console.log('✅ Native dialog API call successful');
        } else {
          console.log('❌ Native dialog API call returned false - method may not be implemented on native side');
        }
      } else {
        console.log('❌ logDialogShowEvent method not found on AcousticConnectRN');
      }
    } catch (error) {
      console.error('❌ Native dialog API error:', error);
    }
  };

  // Test TLTRN dialog tracking
  const testTLTRNDialogTracking = async () => {
    console.log('🧪 Testing TLTRN dialog tracking...');
    try {
      const { TLTRN } = require('react-native-acoustic-connect');
      console.log('🔍 TLTRN methods available:', Object.keys(TLTRN));
      
      if (typeof TLTRN.logDialogShowEvent === 'function') {
        const result = await TLTRN.logDialogShowEvent('tltrn-test', 'TLTRN Test Dialog', 'test');
        console.log('TLTRN dialog tracking result:', result);
        if (result) {
          console.log('✅ TLTRN dialog tracking successful');
        } else {
          console.log('❌ TLTRN dialog tracking returned false - native method may not be implemented');
        }
      } else {
        console.log('❌ TLTRN.logDialogShowEvent method not found');
      }
    } catch (error) {
      console.error('❌ TLTRN dialog tracking error:', error);
    }
  };

  // Test DialogListener functionality
  const testDialogListener = () => {
    console.log('🧪 Testing DialogListener...');
    try {
      const { DialogListener } = require('react-native-acoustic-connect');
      const dialogListener = DialogListener.getInstance();
      console.log('✅ DialogListener instance:', dialogListener);
      console.log('🔍 DialogListener isIntercepting:', (dialogListener as any).isIntercepting);
      console.log('🔍 DialogListener active dialogs:', dialogListener.getActiveDialogs());
    } catch (error) {
      console.error('❌ DialogListener test error:', error);
    }
  };

  // Test useDialogTracking hook
  const testUseDialogTracking = () => {
    console.log('🧪 Testing useDialogTracking hook...');
    try {
      const { useDialogTracking } = require('react-native-acoustic-connect');
      console.log('✅ useDialogTracking hook available');
      
      // Note: This can only be tested within a React component
      console.log('ℹ️ useDialogTracking hook can only be used within React components');
    } catch (error) {
      console.error('❌ useDialogTracking test error:', error);
    }
  };

  // Test dialog dismiss event
  const testDialogDismiss = async () => {
    console.log('🧪 Testing dialog dismiss event...');
    try {
      const { TLTRN } = require('react-native-acoustic-connect');
      const result = await TLTRN.logDialogDismissEvent('test-dialog', 'user_action');
      console.log('Dialog dismiss result:', result);
      if (result) {
        console.log('✅ Dialog dismiss event successful');
      } else {
        console.log('❌ Dialog dismiss event returned false');
      }
    } catch (error) {
      console.error('❌ Dialog dismiss error:', error);
    }
  };

  // Test dialog button click event
  const testDialogButtonClick = async () => {
    console.log('🧪 Testing dialog button click event...');
    try {
      const { TLTRN } = require('react-native-acoustic-connect');
      const result = await TLTRN.logDialogButtonClickEvent('test-dialog', 'Test Button', 0);
      console.log('Dialog button click result:', result);
      if (result) {
        console.log('✅ Dialog button click event successful');
      } else {
        console.log('❌ Dialog button click event returned false');
      }
    } catch (error) {
      console.error('❌ Dialog button click error:', error);
    }
  };

  // Test dialog custom event
  const testDialogCustomEvent = async () => {
    console.log('🧪 Testing dialog custom event...');
    try {
      const { TLTRN } = require('react-native-acoustic-connect');
      const result = await TLTRN.logDialogCustomEvent('test-dialog', 'custom_action', { action: 'test' });
      console.log('Dialog custom event result:', result);
      if (result) {
        console.log('✅ Dialog custom event successful');
      } else {
        console.log('❌ Dialog custom event returned false');
      }
    } catch (error) {
      console.error('❌ Dialog custom event error:', error);
    }
  };

  // Test manual dialog tracking
  const testManualDialogTracking = () => {
    console.log('🧪 Testing manual dialog tracking...');
    try {
      const { useDialogTracking } = require('react-native-acoustic-connect');
      console.log('✅ Manual dialog tracking available via useDialogTracking hook');
      console.log('ℹ️ This is the recommended approach for custom dialogs');
    } catch (error) {
      console.error('❌ Manual dialog tracking error:', error);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>Dialog Tracking Test</Text>
        
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.button} onPress={testAlertTracking}>
            <Text style={styles.buttonText}>✅ Test Alert.alert (Auto)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testDialogListener}>
            <Text style={styles.buttonText}>🔍 Test DialogListener</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testUseDialogTracking}>
            <Text style={styles.buttonText}>🔧 Test useDialogTracking Hook</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testManualDialogTracking}>
            <Text style={styles.buttonText}>📝 Test Manual Tracking</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testNativeDialogAPI}>
            <Text style={styles.buttonText}>🔌 Test Native Dialog API</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testTLTRNDialogTracking}>
            <Text style={styles.buttonText}>🔌 Test TLTRN Dialog Tracking</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testDialogDismiss}>
            <Text style={styles.buttonText}>🔌 Test Dialog Dismiss</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testDialogButtonClick}>
            <Text style={styles.buttonText}>🔌 Test Dialog Button Click</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testDialogCustomEvent}>
            <Text style={styles.buttonText}>🔌 Test Dialog Custom Event</Text>
          </TouchableOpacity>
        </ScrollView>
        
        <TouchableOpacity style={styles.closeButton} onPress={close}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
        
        <Text style={styles.info}>
          Check console for tracking logs. Look for 🔍, 🧪, ✅, and ❌ emojis.
        </Text>
        
        <Text style={styles.warning}>
          ⚠️ Native API tests may fail if methods aren't implemented on native side.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  scrollView: {
    maxHeight: 400,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  closeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  info: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 5,
  },
  warning: {
    fontSize: 11,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 5,
    fontWeight: '500',
  },
});

export default DialogTrackingTest; 