/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import { Alert, Platform } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';

export interface DialogEvent {
    dialogId: string;
    dialogTitle: string;
    dialogType: 'alert' | 'custom' | 'modal';
    timestamp: number;
    buttons?: AlertButton[];
}

export interface DialogButtonClickEvent {
    dialogId: string;
    buttonText: string;
    buttonIndex: number;
    timestamp: number;
}

export interface DialogDismissEvent {
    dialogId: string;
    dialogTitle: string;
    dialogType: 'alert' | 'custom' | 'modal';
    dismissReason: string;
    timestamp: number;
}

// Simple ID generator
function generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

class DialogListener {
    private static instance: DialogListener;
    private activeDialogs: Map<string, DialogEvent> = new Map();
    private originalAlert: typeof Alert.alert;
    private isIntercepting: boolean = false;
    private eventCallbacks: Array<(event: DialogEvent | DialogButtonClickEvent | DialogDismissEvent) => void> = [];

    private constructor() {
        this.originalAlert = Alert.alert;
        this.interceptAlertAPI();
    }

    static getInstance(): DialogListener {
        if (!DialogListener.instance) {
            DialogListener.instance = new DialogListener();
        }
        return DialogListener.instance;
    }

    /**
     * Start intercepting dialog events
     */
    startIntercepting(): void {
        if (this.isIntercepting) return;
        this.isIntercepting = true;
        console.log('DialogListener: Started intercepting dialog events');
    }

    /**
     * Stop intercepting dialog events
     */
    stopIntercepting(): void {
        if (!this.isIntercepting) return;
        this.isIntercepting = false;
        console.log('DialogListener: Stopped intercepting dialog events');
    }

    /**
     * Add event callback for dialog events
     */
    addEventListener(callback: (event: DialogEvent | DialogButtonClickEvent | DialogDismissEvent) => void): () => void {
        this.eventCallbacks.push(callback);
        return () => {
            const index = this.eventCallbacks.indexOf(callback);
            if (index > -1) {
                this.eventCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Intercept React Native's Alert.alert API
     */
    private interceptAlertAPI(): void {
        const self = this;
        Alert.alert = function(
            title: string,
            message?: string,
            buttons?: AlertButton[],
            options?: AlertOptions
        ): void {
            if (self.isIntercepting) {
                const dialogId = generateId();
                const dialogEvent: DialogEvent = {
                    dialogId,
                    dialogTitle: title,
                    dialogType: 'alert',
                    timestamp: Date.now(),
                    buttons: buttons || []
                };

                self.activeDialogs.set(dialogId, dialogEvent);
                self.emitEvent(dialogEvent);

                // Create wrapped buttons that log events
                const wrappedButtons = buttons?.map((button, index) => ({
                    ...button,
                    onPress: () => {
                        const buttonClickEvent: DialogButtonClickEvent = {
                            dialogId,
                            buttonText: button.text || '',
                            buttonIndex: index,
                            timestamp: Date.now()
                        };
                        self.emitEvent(buttonClickEvent);
                        self.activeDialogs.delete(dialogId);
                        
                        // Call original onPress if it exists
                        if (button.onPress) {
                            button.onPress();
                        }
                    }
                }));

                // Call original Alert.alert with wrapped buttons
                self.originalAlert.call(Alert, title, message, wrappedButtons, options);
            } else {
                // Call original Alert.alert without interception
                self.originalAlert.call(Alert, title, message, buttons, options);
            }
        };
    }

    /**
     * Manually track custom dialog show event
     */
    trackCustomDialogShow(dialogId: string, title: string, buttons?: AlertButton[]): void {
        if (!this.isIntercepting) return;

        const dialogEvent: DialogEvent = {
            dialogId,
            dialogTitle: title,
            dialogType: 'custom',
            timestamp: Date.now(),
            buttons: buttons || []
        };

        this.activeDialogs.set(dialogId, dialogEvent);
        this.emitEvent(dialogEvent);
    }

    /**
     * Manually track custom dialog dismiss event
     */
    trackCustomDialogDismiss(dialogId: string, reason: string = 'manual'): void {
        if (!this.isIntercepting) return;

        const dialogEvent = this.activeDialogs.get(dialogId);
        if (dialogEvent) {
            this.activeDialogs.delete(dialogId);
            // Emit proper dismiss event
            const dismissEvent: DialogDismissEvent = {
                dialogId,
                dialogTitle: dialogEvent.dialogTitle,
                dialogType: dialogEvent.dialogType,
                dismissReason: reason,
                timestamp: Date.now()
            };
            this.emitEvent(dismissEvent);
            
            // Log the dismiss reason for debugging
            console.log(`Dialog ${dialogId} dismissed with reason: ${reason}`);
        }
    }

    /**
     * Manually track custom dialog button click event
     */
    trackCustomDialogButtonClick(dialogId: string, buttonText: string, buttonIndex: number): void {
        if (!this.isIntercepting) return;

        const buttonClickEvent: DialogButtonClickEvent = {
            dialogId,
            buttonText,
            buttonIndex,
            timestamp: Date.now()
        };

        this.emitEvent(buttonClickEvent);
    }

    /**
     * Get currently active dialogs
     */
    getActiveDialogs(): DialogEvent[] {
        return Array.from(this.activeDialogs.values());
    }

    /**
     * Clear all active dialogs
     */
    clearActiveDialogs(): void {
        this.activeDialogs.clear();
    }

    /**
     * Emit event to all registered callbacks
     */
    private emitEvent(event: DialogEvent | DialogButtonClickEvent | DialogDismissEvent): void {
        this.eventCallbacks.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('DialogListener: Error in event callback:', error);
            }
        });
    }

    /**
     * Restore original Alert.alert API
     */
    restoreOriginalAlert(): void {
        Alert.alert = this.originalAlert;
    }
}

export default DialogListener; 