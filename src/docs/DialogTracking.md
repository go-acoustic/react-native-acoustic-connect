# Dialog Event Tracking

This document describes the dialog event tracking functionality added to the Acoustic Connect React Native SDK.

## Overview

The dialog tracking system provides automatic and manual tracking of dialog popup events and user interactions. It supports:

- **Automatic tracking** of React Native's `Alert.alert()` calls
- **Manual tracking** of custom dialog components
- **Button click tracking** for both automatic and custom dialogs
- **Event logging** to the Acoustic Connect backend

## Features

### 1. Automatic Alert.alert Interception

The system automatically intercepts and tracks all `Alert.alert()` calls without requiring any code changes:

```typescript
// This will be automatically tracked
Alert.alert(
    'Confirmation',
    'Are you sure?',
    [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => console.log('OK pressed') }
    ]
);
```

### 2. Manual Custom Dialog Tracking

For custom dialog components, you can manually track events:

```typescript
import { useDialogTracking } from 'react-native-acoustic-connect';

const MyComponent = () => {
    const { generateDialogId, trackDialogShow, trackDialogDismiss } = useDialogTracking();
    
    const showDialog = () => {
        const dialogId = generateDialogId();
        trackDialogShow(dialogId, 'My Custom Dialog', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK' }
        ]);
        // Show your custom dialog
    };
    
    const hideDialog = () => {
        const dialogId = generateDialogId(); // Store this in your component state
        trackDialogDismiss(dialogId, 'user_dismiss');
        // Hide your custom dialog
    };
};
```

### 3. Button Click Tracking

Track button clicks in custom dialogs:

```typescript
const { createTrackedButton } = useDialogTracking();

const showDialogWithTrackedButtons = () => {
    const dialogId = generateDialogId();
    const originalButtons = [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => console.log('Yes pressed') }
    ];
    
    // Create tracked buttons
    const trackedButtons = originalButtons.map((button, index) => 
        createTrackedButton(dialogId, button, index)
    );
    
    trackDialogShow(dialogId, 'Confirmation', trackedButtons);
};
```

### 4. HOC-Based Automatic Tracking

For the easiest integration, use the HOC (Higher-Order Component) approach:

```typescript
import { withAcousticAutoDialog } from 'react-native-acoustic-connect';
import { Dialog } from 'react-native-paper';

// Create tracked version of your dialog component
const TrackedDialog = withAcousticAutoDialog(Dialog);

// Use normally - all events automatically tracked!
<TrackedDialog 
  visible={dialogVisible} 
  onDismiss={hideDialog}
  title="My Dialog"
>
  <Dialog.Content>
    <Text>Dialog content</Text>
  </Dialog.Content>
  <Dialog.Actions>
    <Button onPress={hideDialog}>Cancel</Button>
    <Button onPress={confirmAction}>Confirm</Button>
  </Dialog.Actions>
</TrackedDialog>
```

The HOC automatically tracks:
- Dialog show events
- Dialog dismiss events  
- Button click events within the dialog
- Recursively scans dialog children for buttons

## Setup

### 1. Enable Dialog Tracking in Connect Component

```typescript
import { Connect } from 'react-native-acoustic-connect';

<Connect 
    captureKeyboardEvents={true}
    captureDialogEvents={true} // Enable dialog tracking
>
    <NavigationContainer ref={navigationRef}>
        {/* Your app content */}
    </NavigationContainer>
</Connect>
```

### 2. Use the useDialogTracking Hook

```typescript
import { useDialogTracking } from 'react-native-acoustic-connect';

const MyComponent = () => {
    const dialogTracking = useDialogTracking();
    
    // Use dialogTracking methods...
};
```

## API Reference

### Connect Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `captureDialogEvents` | `boolean` | `false` | Enable automatic dialog event tracking |

### useDialogTracking Hook

Returns an object with the following methods:

#### `generateDialogId(): string`
Generates a unique dialog identifier.

#### `trackDialogShow(dialogId: string, title: string, buttons?: AlertButton[]): void`
Tracks a dialog show event.

#### `trackDialogDismiss(dialogId: string, reason: string): void`
Tracks a dialog dismiss event.

#### `trackDialogButtonClick(dialogId: string, buttonText: string, buttonIndex: number): void`
Tracks a dialog button click event.

#### `trackDialogCustomEvent(dialogId: string, eventName: string, values: Record<string, string \| number \| boolean>): void`
Tracks a custom dialog event.

#### `createTrackedButton(dialogId: string, button: AlertButton, buttonIndex: number): AlertButton`
Creates a button with automatic click tracking.

#### `cleanup(): void`
Cleans up dialog tracking state.

### DialogListener Class

For advanced usage, you can directly use the DialogListener class:

```typescript
import { DialogListener } from 'react-native-acoustic-connect';

const dialogListener = DialogListener.getInstance();
dialogListener.startIntercepting();
dialogListener.addEventListener((event) => {
    console.log('Dialog event:', event);
});
```

## Event Types

### DialogEvent
```typescript
interface DialogEvent {
    dialogId: string;
    dialogTitle: string;
    dialogType: 'alert' | 'custom' | 'modal';
    timestamp: number;
    buttons?: AlertButton[];
}
```

### DialogButtonClickEvent
```typescript
interface DialogButtonClickEvent {
    dialogId: string;
    buttonText: string;
    buttonIndex: number;
    timestamp: number;
}
```

## Native Interface Methods

The following methods are added to the AcousticConnectRN interface:

- `logDialogShowEvent(dialogId: string, dialogTitle: string, dialogType: string): boolean`
- `logDialogDismissEvent(dialogId: string, dismissReason: string): boolean`
- `logDialogButtonClickEvent(dialogId: string, buttonText: string, buttonIndex: number): boolean`
- `logDialogCustomEvent(dialogId: string, eventName: string, values: Record<string, string \| number \| boolean>): boolean`

## Best Practices

1. **Store Dialog IDs**: When manually tracking custom dialogs, store the dialog ID in your component state to properly track dismiss events.

2. **Use Consistent Naming**: Use descriptive dialog titles and button text for better analytics.

3. **Handle Errors**: Wrap dialog tracking calls in try-catch blocks to prevent app crashes.

4. **Clean Up**: Call the cleanup method when components unmount to prevent memory leaks.

## Example Implementation

See `src/examples/DialogTrackingExample.tsx` for a complete example showing all features.

## Troubleshooting

### Dialog events not being tracked
1. Ensure `captureDialogEvents={true}` is set on the Connect component
2. Check that the DialogListener is properly initialized
3. Verify that the native AcousticConnectRN interface is available

### Custom dialog tracking not working
1. Make sure you're calling `trackDialogShow` before showing the dialog
2. Store the dialog ID and use it consistently for dismiss events
3. Use `createTrackedButton` for automatic button click tracking

### Performance considerations
- Dialog tracking is lightweight and shouldn't impact app performance
- The system uses efficient event delegation and cleanup
- Dialog IDs are generated using a simple algorithm to avoid external dependencies 