/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import { useCallback, useRef } from 'react';
import type { AlertButton } from 'react-native';
import DialogListener from './DialogListener';
import TLTRN from '../TLTRN';

/**
 * React hook for tracking custom dialog events
 * Provides utilities to track dialog show, dismiss, and button click events
 */
export const useDialogTracking = () => {
    const dialogIds = useRef<Set<string>>(new Set());

    /**
     * Generate a unique dialog ID
     */
    const generateDialogId = useCallback((): string => {
        const id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        dialogIds.current.add(id);
        return id;
    }, []);

    /**
     * Track a custom dialog show event
     */
    const trackDialogShow = useCallback((dialogId: string, title: string, buttons?: AlertButton[]) => {
        DialogListener.getInstance().trackCustomDialogShow(dialogId, title, buttons);
        // Note: The actual native call is handled by the DialogListener event system
        // No need to call TLTRN.logDialogShowEvent directly here
    }, []);

    /**
     * Track a custom dialog dismiss event
     */
    const trackDialogDismiss = useCallback((dialogId: string, reason: string = 'manual') => {
        DialogListener.getInstance().trackCustomDialogDismiss(dialogId, reason);
        // Note: The actual native call is handled by the DialogListener event system
        // No need to call TLTRN.logDialogDismissEvent directly here
    }, []);

    /**
     * Track a custom dialog button click event
     */
    const trackDialogButtonClick = useCallback((dialogId: string, buttonText: string, buttonIndex: number) => {
        DialogListener.getInstance().trackCustomDialogButtonClick(dialogId, buttonText, buttonIndex);
        // Note: The actual native call is handled by the DialogListener event system
        // No need to call TLTRN.logDialogButtonClickEvent directly here
    }, []);

    /**
     * Track a custom dialog event
     */
    const trackDialogCustomEvent = useCallback((dialogId: string, eventName: string, values: Record<string, string | number | boolean>) => {
        TLTRN.logDialogCustomEvent(dialogId, eventName, values);
    }, []);

    /**
     * Create a wrapped button with automatic tracking
     */
    const createTrackedButton = useCallback((dialogId: string, button: AlertButton, buttonIndex: number): AlertButton => {
        return {
            ...button,
            onPress: () => {
                // Track the button click
                trackDialogButtonClick(dialogId, button.text || '', buttonIndex);
                
                // Call the original onPress if it exists
                if (button.onPress) {
                    button.onPress();
                }
            }
        };
    }, [trackDialogButtonClick]);

    /**
     * Clean up dialog tracking
     */
    const cleanup = useCallback(() => {
        dialogIds.current.clear();
    }, []);

    return {
        generateDialogId,
        trackDialogShow,
        trackDialogDismiss,
        trackDialogButtonClick,
        trackDialogCustomEvent,
        createTrackedButton,
        cleanup
    };
};

export default useDialogTracking; 