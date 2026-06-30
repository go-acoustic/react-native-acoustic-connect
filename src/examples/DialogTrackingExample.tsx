/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import React, { useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import { useDialogTracking } from '../utils/useDialogTracking';

/**
 * Example component demonstrating dialog event tracking
 * Shows how to use both automatic Alert.alert interception and manual custom dialog tracking
 */
const DialogTrackingExample: React.FC = () => {
    const [customDialogVisible, setCustomDialogVisible] = useState(false);
    const { 
        generateDialogId, 
        trackDialogShow, 
        trackDialogDismiss, 
        createTrackedButton 
    } = useDialogTracking();

    // Example 1: Automatic Alert.alert tracking (no additional code needed)
    const showAlertDialog = () => {
        Alert.alert(
            'Confirmation',
            'Are you sure you want to proceed?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => console.log('OK pressed') }
            ]
        );
    };

    // Example 2: Manual custom dialog tracking
    const showCustomDialog = () => {
        const dialogId = generateDialogId();
        const title = 'Custom Dialog';
        const buttons = [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Confirm', onPress: () => console.log('Confirm pressed') }
        ];

        // Track dialog show event
        trackDialogShow(dialogId, title, buttons);
        setCustomDialogVisible(true);
    };

    const hideCustomDialog = () => {
        const dialogId = generateDialogId(); // In real app, you'd store this
        trackDialogDismiss(dialogId, 'user_dismiss');
        setCustomDialogVisible(false);
    };

    // Example 3: Custom dialog with tracked buttons
    const showTrackedCustomDialog = () => {
        const dialogId = generateDialogId();
        const title = 'Tracked Custom Dialog';
        const originalButtons = [
            { text: 'No', style: 'cancel' as const },
            { text: 'Yes', onPress: () => console.log('Yes pressed') }
        ];

        // Create tracked buttons
        const trackedButtons = originalButtons.map((button, index) => 
            createTrackedButton(dialogId, button, index)
        );

        trackDialogShow(dialogId, title, trackedButtons);
        setCustomDialogVisible(true);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Dialog Tracking Examples</Text>
            
            <View style={styles.buttonContainer}>
                <Button 
                    title="Show Alert Dialog (Auto-tracked)" 
                    onPress={showAlertDialog} 
                />
            </View>

            <View style={styles.buttonContainer}>
                <Button 
                    title="Show Custom Dialog (Manual tracking)" 
                    onPress={showCustomDialog} 
                />
            </View>

            <View style={styles.buttonContainer}>
                <Button 
                    title="Show Tracked Custom Dialog" 
                    onPress={showTrackedCustomDialog} 
                />
            </View>

            {customDialogVisible && (
                <View style={styles.customDialog}>
                    <Text style={styles.dialogTitle}>Custom Dialog</Text>
                    <Text style={styles.dialogMessage}>
                        This is a custom dialog with manual tracking
                    </Text>
                    <View style={styles.dialogButtons}>
                        <Button title="Cancel" onPress={hideCustomDialog} />
                        <Button title="OK" onPress={hideCustomDialog} />
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
    },
    buttonContainer: {
        marginVertical: 10,
    },
    customDialog: {
        position: 'absolute',
        top: '50%',
        left: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    dialogTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    dialogMessage: {
        fontSize: 16,
        marginBottom: 20,
    },
    dialogButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
});

export default DialogTrackingExample; 