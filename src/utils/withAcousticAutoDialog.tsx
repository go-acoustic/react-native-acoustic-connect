/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
* 
* Created on 5/9/25.
* 
********************************************************************************************/

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useDialogTracking } from './useDialogTracking';
import AcousticConnectRN from '../index';

/**
 * HOC Wrapper that automatically tracks dialog show/dismiss events and button clicks
 * Works with any dialog component that has 'visible' and 'onDismiss' props
 * 
 * Supported Dialog Patterns:
 * - react-native-paper Dialog components
 * - Custom modal components with visible/onDismiss props
 * - Components with different prop names (show/hide, open/close, etc.)
 * - Components with custom button implementations
 * - Components with nested dialog structures
 */
export function withAcousticAutoDialog(
  DialogComponent: React.ComponentType<any>
): React.ComponentType<any> {
  return forwardRef<any, any>((props, ref) => {
    const { generateDialogId } = useDialogTracking();
    const dialogIdRef = useRef<string | null>(null);
    const isVisibleRef = useRef(false);

    // Track button click event
    const trackButtonClick = useCallback((buttonText: string, buttonIndex: number) => {
      if (dialogIdRef.current) {
        AcousticConnectRN.logDialogButtonClickEvent(dialogIdRef.current, buttonText, buttonIndex);
        console.log(`🔍 withAcousticAutoDialog: Button clicked - ${buttonText} (${dialogIdRef.current})`);
      }
    }, []);

    // Wrap button onPress handlers to track clicks
    const wrapButtonOnPress = useCallback((originalOnPress: (() => void) | undefined, buttonText: string, buttonIndex: number) => {
      return () => {
        trackButtonClick(buttonText, buttonIndex);
        if (originalOnPress) {
          originalOnPress();
        }
      };
    }, [trackButtonClick]);

    // Recursively wrap buttons in children
    const wrapButtonsInChildren = useCallback((children: any, buttonIndex: number = 0): any => {
      if (!children) return children;

      if (Array.isArray(children)) {
        return children.map((child, index) => wrapButtonsInChildren(child, buttonIndex + index));
      }

      if (React.isValidElement(children)) {
        const childProps = children.props as any;
        
        // Check if this is a button component (supports various button types)
        const isButton = 
          (typeof children.type === 'function' && 
           ((children.type as any).displayName === 'Button' ||
            (children.type as any).name === 'Button' ||
            (children.type as any).displayName === 'DialogAction' ||
            (children.type as any).name === 'DialogAction' ||
            (children.type as any).displayName === 'TouchableOpacity' ||
            (children.type as any).name === 'TouchableOpacity' ||
            (children.type as any).displayName === 'Pressable' ||
            (children.type as any).name === 'Pressable')) ||
          (childProps && (childProps.onPress || childProps.onPressIn || childProps.onPressOut || childProps.onTouchEnd));

        if (isButton && childProps?.onPress) {
          const buttonText = childProps.children || childProps.title || 'Button';
          return React.cloneElement(children, {
            ...childProps,
            onPress: wrapButtonOnPress(childProps.onPress, buttonText, buttonIndex)
          } as any);
        }

        // Recursively wrap buttons in nested children
        if (childProps?.children) {
          return React.cloneElement(children, {
            ...childProps,
            children: wrapButtonsInChildren(childProps.children, buttonIndex)
          } as any);
        }
      }

      return children;
    }, [wrapButtonOnPress]);

    // Track dialog show event when visible changes to true
    // Supports various visibility prop names: visible, show, open, isOpen, isVisible
    const isVisible = props.visible || props.show || props.open || props.isOpen || props.isVisible;
    
    useEffect(() => {
      if (isVisible && !isVisibleRef.current) {
        const dialogId = generateDialogId();
        dialogIdRef.current = dialogId;
        isVisibleRef.current = true;

                // Get dialog title from various possible sources
        const getDialogTitle = (): string => {
          // Try to get title from props (supports various prop names)
          if (props.title) return props.title;
          if (props.dialogTitle) return props.dialogTitle;
          if (props.header) return props.header;
          if (props.heading) return props.heading;
          if (props.name) return props.name;
          
                  // Try to get title from children (for react-native-paper Dialog)
        if (props.children) {
          console.log(`🔍 withAcousticAutoDialog: Starting title extraction from children`);
          console.log(`🔍 withAcousticAutoDialog: Initial children:`, props.children);
          
          const extractTitleFromChildren = (children: any, depth: number = 0): string | null => {
              if (!children) return null;
              
              if (Array.isArray(children)) {
                for (const child of children) {
                  const title = extractTitleFromChildren(child, depth + 1);
                  if (title) return title;
                }
                return null;
              }
              
              if (React.isValidElement(children)) {
                const childProps = children.props as any;
                
                // Debug: Log component info for debugging
                console.log(`🔍 withAcousticAutoDialog: Processing component at depth ${depth}:`, {
                  type: children.type,
                  displayName: (children.type as any)?.displayName,
                  name: (children.type as any)?.name,
                  hasChildren: !!childProps?.children,
                  childrenType: typeof childProps?.children
                });
                
                // Check if this is a Dialog component from react-native-paper
                if (children.type && 
                    typeof children.type === 'function' &&
                    ((children.type as any).displayName === 'Dialog' ||
                     (children.type as any).name === 'Dialog')) {
                  console.log(`🔍 withAcousticAutoDialog: Found Dialog component at depth ${depth}`);
                  // Extract title from Dialog children
                  if (childProps?.children) {
                    return extractTitleFromChildren(childProps.children, depth + 1);
                  }
                }
                
                // Check if this is a Portal component (common wrapper for dialogs)
                if (children.type && 
                    typeof children.type === 'function' &&
                    ((children.type as any).displayName === 'Portal' ||
                     (children.type as any).name === 'Portal')) {
                  console.log(`🔍 withAcousticAutoDialog: Found Portal component at depth ${depth}`);
                  // Extract title from Portal children
                  if (childProps?.children) {
                    return extractTitleFromChildren(childProps.children, depth + 1);
                  }
                }
                
                // Check if this is a DialogTitle component (supports various title component types)
                if (children.type && 
                    typeof children.type === 'function' &&
                    ((children.type as any).displayName === 'DialogTitle' ||
                     (children.type as any).name === 'DialogTitle' ||
                     (children.type as any).displayName === 'Title' ||
                     (children.type as any).name === 'Title' ||
                     (children.type as any).displayName === 'Header' ||
                     (children.type as any).name === 'Header' ||
                     (children.type as any).displayName === 'Heading' ||
                     (children.type as any).name === 'Heading')) {
                  if (childProps?.children && typeof childProps.children === 'string') {
                    console.log(`🔍 withAcousticAutoDialog: Found title in title component: "${childProps.children}"`);
                    return childProps.children;
                  }
                }
                
                // Check if this component has title content
                if (childProps?.title) {
                  return childProps.title;
                }
                
                // Recursively search in nested children
                if (childProps?.children) {
                  return extractTitleFromChildren(childProps.children, depth + 1);
                }
              }
              
              return null;
            };
            
            const title = extractTitleFromChildren(props.children);
            if (title) {
              console.log(`🔍 withAcousticAutoDialog: Found title from children: "${title}"`);
              return title;
            }
          }
          
          return 'Dialog';
        };

        const title = getDialogTitle();
        
        // Log dialog show event
        AcousticConnectRN.logDialogShowEvent(dialogId, title, 'custom');
        console.log(`🔍 withAcousticAutoDialog: Dialog shown - ${title} (${dialogId})`);
      } else if (!isVisible && isVisibleRef.current) {
        // Track dialog dismiss event when visible changes to false
        if (dialogIdRef.current) {
          AcousticConnectRN.logDialogDismissEvent(dialogIdRef.current, 'user_action');
          console.log(`🔍 withAcousticAutoDialog: Dialog dismissed - ${dialogIdRef.current}`);
          dialogIdRef.current = null;
        }
        isVisibleRef.current = false;
      }
    }, [isVisible, generateDialogId]);

    // Handle dismiss events (supports various dismiss prop names)
    const handleDismiss = () => {
      if (dialogIdRef.current) {
        AcousticConnectRN.logDialogDismissEvent(dialogIdRef.current, 'user_action');
        console.log(`🔍 withAcousticAutoDialog: Dialog dismissed via dismiss handler - ${dialogIdRef.current}`);
        dialogIdRef.current = null;
      }
      isVisibleRef.current = false;
      
      // Call original dismiss handler if it exists (supports various prop names)
      if (props.onDismiss) {
        props.onDismiss();
      } else if (props.onClose) {
        props.onClose();
      } else if (props.onHide) {
        props.onHide();
      } else if (props.close) {
        props.close();
      } else if (props.hide) {
        props.hide();
      }
    };

    // Forward ref to the wrapped component
    useImperativeHandle(ref, () => {
      return {
        ...ref,
        // Add any additional methods if needed
      };
    }, [ref]);

    // Wrap buttons in children to track clicks
    const wrappedChildren = wrapButtonsInChildren(props.children);

    // Determine which dismiss prop to use based on what the original component expects
    const dismissProps: any = {};
    if (props.onDismiss) {
      dismissProps.onDismiss = handleDismiss;
    } else if (props.onClose) {
      dismissProps.onClose = handleDismiss;
    } else if (props.onHide) {
      dismissProps.onHide = handleDismiss;
    } else if (props.close) {
      dismissProps.close = handleDismiss;
    } else if (props.hide) {
      dismissProps.hide = handleDismiss;
    } else {
      // Default to onDismiss if no dismiss prop is found
      dismissProps.onDismiss = handleDismiss;
    }

    return (
      <DialogComponent
        {...props}
        {...dismissProps}
        ref={ref}
        children={wrappedChildren}
      />
    );
  });
}

/**
 * Convenience function to create tracked versions of common dialog components
 */
export function createTrackedDialogComponents() {
  // Note: These would need to be imported in the consuming app
  // This is just a template for how to use the HOC
  
  return {
    // Example usage (uncomment when react-native-paper is available):
    // TrackedDialog: withAcousticAutoDialog(require('react-native-paper').Dialog),
    // TrackedPortal: withAcousticAutoDialog(require('react-native-paper').Portal),
  };
}

/**
 * Hook to get tracked dialog components
 */
export function useTrackedDialogs() {
  return {
    withAcousticAutoDialog,
    createTrackedDialogComponents,
  };
} 
