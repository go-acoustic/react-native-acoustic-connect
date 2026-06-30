/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Connect from '../components/Connect';

/**
 * Example demonstrating HOC-based Paper Dialog tracking
 * 
 * This approach requires minimal code changes:
 * 1. Create tracked versions of your dialog components
 * 2. Use the tracked versions instead of the original ones
 * 3. All dialog events are automatically tracked!
 */
const HOCDialogExample: React.FC = () => {
  const [dialogVisible, setDialogVisible] = React.useState(false);

  // Example 1: React Native Alert.alert (automatically tracked)
  const showAlertDialog = () => {
    Alert.alert(
      'Confirmation Alert',
      'This is a native alert dialog that is automatically tracked.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => console.log('Alert OK pressed') }
      ]
    );
  };

  // Example 2: Paper Dialog with HOC tracking
  const showPaperDialog = () => {
    setDialogVisible(true);
  };

  const hidePaperDialog = () => {
    setDialogVisible(false);
  };

  return (
    <Connect captureDialogEvents={true} captureKeyboardEvents={false}>
      <View style={styles.container}>
        <Text style={styles.title}>HOC Dialog Tracking Example</Text>
        <Text style={styles.subtitle}>
          Minimal code changes required - just wrap your dialog components!
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={showAlertDialog}>
            <Text style={styles.buttonText}>Show Alert.alert</Text>
            <Text style={styles.buttonSubtext}>Automatically tracked</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={showPaperDialog}>
            <Text style={styles.buttonText}>Show Paper Dialog (HOC)</Text>
            <Text style={styles.buttonSubtext}>Minimal code changes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>How to use HOC approach:</Text>
          <Text style={styles.infoText}>1. Create tracked dialog components</Text>
          <Text style={styles.infoText}>2. Use tracked versions instead of originals</Text>
          <Text style={styles.infoText}>3. All events automatically tracked!</Text>
          <Text style={styles.infoText}>4. No manual tracking code needed</Text>
        </View>

        <View style={styles.codeContainer}>
          <Text style={styles.codeTitle}>Example Setup Code:</Text>
          <Text style={styles.codeText}>
            {`// In your app setup
import { withAcousticAutoDialog } from 'react-native-acoustic-connect';
import { Dialog, Portal } from 'react-native-paper';

// Create tracked versions
const TrackedDialog = withAcousticAutoDialog(Dialog);
const TrackedPortal = withAcousticAutoDialog(Portal);

// Use TrackedDialog instead of Dialog - that's it!`}
          </Text>
        </View>

        {/* Example of how the tracked dialog would be used */}
        {dialogVisible && (
          <View style={styles.exampleDialog}>
            <Text style={styles.dialogTitle}>Example Dialog</Text>
            <Text style={styles.dialogContent}>
              This shows how you would use the tracked dialog components.
              In a real app, you would use TrackedDialog instead of Dialog.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogButton} onPress={hidePaperDialog}>
                <Text style={styles.dialogButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.primaryButton]} 
                onPress={() => {
                  console.log('Dialog confirmed!');
                  hidePaperDialog();
                }}
              >
                <Text style={styles.dialogButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Connect>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  codeContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  codeText: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  exampleDialog: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  dialogContent: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  dialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default HOCDialogExample; 