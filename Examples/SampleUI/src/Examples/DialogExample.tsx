import * as React from 'react';
import { Platform, StyleSheet, Alert } from 'react-native';

import { Button } from 'react-native-paper';

import {
  DialogWithCustomColors,
  DialogWithDismissableBackButton,
  DialogWithIcon,
  DialogWithLoadingIndicator,
  DialogWithLongText,
  DialogWithRadioBtns,
  UndismissableDialog,
  DialogTrackingTest,
} from './Dialogs';
import { useExampleTheme } from '..';
import ScreenWrapper from '../ScreenWrapper';
import { useDialogTracking } from 'react-native-acoustic-connect';

type ButtonVisibility = {
  [key: string]: boolean | undefined;
};

const DialogExample = () => {
  const [visible, setVisible] = React.useState<ButtonVisibility>({});
  const { isV3 } = useExampleTheme();
  
  // Add dialog tracking
  const { generateDialogId, trackDialogShow, trackDialogDismiss } = useDialogTracking();
  const [dialogIds, setDialogIds] = React.useState<Record<string, string>>({});

  const _toggleDialog = (name: string) => () => {
    const isCurrentlyVisible = !!visible[name];
    
    if (!isCurrentlyVisible) {
      // Dialog is being shown - track it
      const dialogId = generateDialogId();
      setDialogIds(prev => ({ ...prev, [name]: dialogId }));
      
      // Get dialog title based on the dialog type
      const getDialogTitle = (dialogName: string): string => {
        switch (dialogName) {
          case 'dialog1': return 'Long Text Dialog';
          case 'dialog2': return 'Radio Buttons Dialog';
          case 'dialog3': return 'Progress Indicator Dialog';
          case 'dialog4': return 'Undismissable Dialog';
          case 'dialog5': return 'Custom Colors Dialog';
          case 'dialog6': return 'Dialog with Icon';
          case 'dialog7': return 'Dismissable Back Button Dialog';
          case 'dialogTracking': return 'Dialog Tracking Test';
          default: return 'Dialog';
        }
      };
      
      const title = getDialogTitle(name);
      trackDialogShow(dialogId, title, []);
      
      console.log(`🔍 DialogExample: Showing dialog - ${title} (${dialogId})`);
    } else {
      // Dialog is being hidden - track dismiss
      const dialogId = dialogIds[name];
      if (dialogId) {
        trackDialogDismiss(dialogId, 'user_action');
        console.log(`🔍 DialogExample: Dismissing dialog - ${dialogIds[name]} (${dialogId})`);
        setDialogIds(prev => {
          const newIds = { ...prev };
          delete newIds[name];
          return newIds;
        });
      }
    }
    
    setVisible({ ...visible, [name]: !visible[name] });
  };

  const _getVisible = (name: string) => !!visible[name];

  return (
    <ScreenWrapper style={styles.container}>
      <Button
        mode="outlined"
        onPress={_toggleDialog('dialog1')}
        style={styles.button}
        testID="dialog-long-text-button"
      >
        Long text
      </Button>
      <Button
        mode="outlined"
        onPress={_toggleDialog('dialog2')}
        style={styles.button}
        testID="dialog-radio-buttons-button"
      >
        Radio buttons
      </Button>
      <Button
        mode="outlined"
        onPress={_toggleDialog('dialog3')}
        style={styles.button}
        testID="dialog-progress-indicator-button"
      >
        Progress indicator
      </Button>
      <Button
        mode="outlined"
        onPress={_toggleDialog('dialog4')}
        style={styles.button}
        testID="dialog-undismissable-button"
      >
        Undismissable Dialog
      </Button>
      <Button
        mode="outlined"
        onPress={_toggleDialog('dialog5')}
        style={styles.button}
        testID="dialog-custom-colors-button"
      >
        Custom colors
      </Button>
      {isV3 && (
        <Button
          mode="outlined"
          onPress={_toggleDialog('dialog6')}
          style={styles.button}
          testID="dialog-with-icon-button"
        >
          With icon
        </Button>
      )}
      {Platform.OS === 'android' && (
        <Button
          mode="outlined"
          onPress={_toggleDialog('dialog7')}
          style={styles.button}
          testID="dialog-dismissable-back-button"
        >
          Dismissable back button
        </Button>
      )}
      <Button
        mode="outlined"
        onPress={_toggleDialog('dialogTracking')}
        style={styles.button}
        testID="dialog-tracking-test-button"
      >
        Dialog Tracking Test
      </Button>
      <Button
        mode="outlined"
        onPress={() => {
          console.log('🧪 Testing Alert.alert tracking...');
          Alert.alert(
            'Test Alert',
            'This is a test alert for dialog tracking',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'OK', onPress: () => console.log('✅ OK pressed') }
            ]
          );
        }}
        style={styles.button}
        testID="test-alert-button"
      >
        Test Alert
      </Button>
      <DialogWithLongText
        visible={_getVisible('dialog1')}
        close={_toggleDialog('dialog1')}
      />
      <DialogWithRadioBtns
        visible={_getVisible('dialog2')}
        close={_toggleDialog('dialog2')}
      />
      <DialogWithLoadingIndicator
        visible={_getVisible('dialog3')}
        close={_toggleDialog('dialog3')}
      />
      <UndismissableDialog
        visible={_getVisible('dialog4')}
        close={_toggleDialog('dialog4')}
      />
      <DialogWithCustomColors
        visible={_getVisible('dialog5')}
        close={_toggleDialog('dialog5')}
      />
      {isV3 && (
        <DialogWithIcon
          visible={_getVisible('dialog6')}
          close={_toggleDialog('dialog6')}
        />
      )}
      <DialogWithDismissableBackButton
        visible={_getVisible('dialog7')}
        close={_toggleDialog('dialog7')}
      />
      
      {/* Dialog Tracking Test Component */}
      <DialogTrackingTest
        visible={_getVisible('dialogTracking')}
        close={_toggleDialog('dialogTracking')}
      />
    </ScreenWrapper>
  );
};

DialogExample.title = 'Dialog';

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  button: {
    margin: 4,
  },
});

export default DialogExample;
