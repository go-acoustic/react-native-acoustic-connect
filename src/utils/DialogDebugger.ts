/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import { Alert } from 'react-native';
import DialogListener from './DialogListener';
import TLTRN from '../TLTRN';

/**
 * Debug utility for dialog event tracking
 * Helps identify issues with dialog event interception and logging
 */
export class DialogDebugger {
    private static instance: DialogDebugger;
    private isEnabled: boolean = false;
    private originalAlert: typeof Alert.alert;

    private constructor() {
        this.originalAlert = Alert.alert;
    }

    static getInstance(): DialogDebugger {
        if (!DialogDebugger.instance) {
            DialogDebugger.instance = new DialogDebugger();
        }
        return DialogDebugger.instance;
    }

    /**
     * Enable debug mode
     */
    enable(): void {
        this.isEnabled = true;
        console.log('🔍 DialogDebugger: Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disable(): void {
        this.isEnabled = false;
        console.log('🔍 DialogDebugger: Debug mode disabled');
    }

    /**
     * Test the complete dialog event flow
     */
    testDialogEventFlow(): void {
        console.log('🔍 DialogDebugger: Testing dialog event flow...');
        
        // Test 1: Check if DialogListener is working
        this.testDialogListener();
        
        // Test 2: Check if TLTRN methods are accessible
        this.testTLTRNMethods();
        
        // Test 3: Check if Alert.alert override is working
        this.testAlertOverride();
        
        // Test 4: Test native method calls
        this.testNativeMethods();
    }

    /**
     * Test DialogListener functionality
     */
    private testDialogListener(): void {
        console.log('🔍 DialogDebugger: Testing DialogListener...');
        
        try {
            const dialogListener = DialogListener.getInstance();
            console.log('✅ DialogListener.getInstance() - SUCCESS');
            
            // Test event listener
            const unsubscribe = dialogListener.addEventListener((event) => {
                console.log('🔍 DialogDebugger: DialogListener event received:', event);
            });
            console.log('✅ DialogListener.addEventListener() - SUCCESS');
            
            // Test manual tracking
            dialogListener.trackCustomDialogShow('test-dialog-id', 'Test Dialog', []);
            console.log('✅ DialogListener.trackCustomDialogShow() - SUCCESS');
            
            unsubscribe();
        } catch (error) {
            console.error('❌ DialogDebugger: DialogListener test failed:', error);
        }
    }

    /**
     * Test TLTRN methods
     */
    private testTLTRNMethods(): void {
        console.log('🔍 DialogDebugger: Testing TLTRN methods...');
        
        try {
            // Test if TLTRN methods exist
            if (typeof TLTRN.logDialogShowEvent === 'function') {
                console.log('✅ TLTRN.logDialogShowEvent - EXISTS');
            } else {
                console.error('❌ TLTRN.logDialogShowEvent - NOT FOUND');
            }
            
            if (typeof TLTRN.interceptDialogEvents === 'function') {
                console.log('✅ TLTRN.interceptDialogEvents - EXISTS');
            } else {
                console.error('❌ TLTRN.interceptDialogEvents - NOT FOUND');
            }
            
            // Test method call
            TLTRN.logDialogShowEvent('test-dialog-id', 'Test Dialog', 'test');
            console.log('✅ TLTRN.logDialogShowEvent() - CALLED');
            
        } catch (error) {
            console.error('❌ DialogDebugger: TLTRN test failed:', error);
        }
    }

    /**
     * Test Alert.alert override
     */
    private testAlertOverride(): void {
        console.log('🔍 DialogDebugger: Testing Alert.alert override...');
        
        try {
            // Check if Alert.alert is overridden
            if (Alert.alert !== this.originalAlert) {
                console.log('✅ Alert.alert is overridden');
            } else {
                console.error('❌ Alert.alert is NOT overridden');
            }
            
            // Test Alert.alert call
            Alert.alert('Debug Test', 'This is a test alert', [
                { text: 'OK', onPress: () => console.log('🔍 DialogDebugger: Alert OK pressed') }
            ]);
            console.log('✅ Alert.alert() - CALLED');
            
        } catch (error) {
            console.error('❌ DialogDebugger: Alert.alert test failed:', error);
        }
    }

    /**
     * Test native method calls
     */
    private testNativeMethods(): void {
        console.log('🔍 DialogDebugger: Testing native method calls...');
        
        try {
            // Import AcousticConnectRN to test native calls
            const AcousticConnectRN = require('../index').default;
            
            if (AcousticConnectRN && typeof AcousticConnectRN.logDialogShowEvent === 'function') {
                console.log('✅ AcousticConnectRN.logDialogShowEvent - EXISTS');
                
                // Test native call
                const result = AcousticConnectRN.logDialogShowEvent('test-dialog-id', 'Test Dialog', 'test');
                console.log('✅ AcousticConnectRN.logDialogShowEvent() - CALLED, result:', result);
            } else {
                console.error('❌ AcousticConnectRN.logDialogShowEvent - NOT FOUND');
            }
            
        } catch (error) {
            console.error('❌ DialogDebugger: Native method test failed:', error);
        }
    }

    /**
     * Check if dialog tracking is properly enabled
     */
    checkDialogTrackingStatus(): void {
        console.log('🔍 DialogDebugger: Checking dialog tracking status...');
        
        // Check DialogListener status
        const dialogListener = DialogListener.getInstance();
        console.log('DialogListener status:', {
            isIntercepting: (dialogListener as any).isIntercepting,
            eventCallbacksCount: (dialogListener as any).eventCallbacks?.length || 0
        });
        
        // Check if Alert.alert is overridden
        console.log('Alert.alert override status:', {
            isOverridden: Alert.alert !== this.originalAlert,
            originalAlert: this.originalAlert,
            currentAlert: Alert.alert
        });
        
        // Check TLTRN methods
        console.log('TLTRN methods status:', {
            logDialogShowEvent: typeof TLTRN.logDialogShowEvent,
            interceptDialogEvents: typeof TLTRN.interceptDialogEvents
        });
    }

    /**
     * Force enable dialog tracking for testing
     */
    forceEnableDialogTracking(): void {
        console.log('🔍 DialogDebugger: Force enabling dialog tracking...');
        
        try {
            // Force enable DialogListener
            const dialogListener = DialogListener.getInstance();
            (dialogListener as any).isIntercepting = true;
            console.log('✅ DialogListener interception forced enabled');
            
            // Force enable TLTRN dialog events
            TLTRN.interceptDialogEvents(true);
            console.log('✅ TLTRN dialog events forced enabled');
            
        } catch (error) {
            console.error('❌ DialogDebugger: Force enable failed:', error);
        }
    }
}

export default DialogDebugger; 