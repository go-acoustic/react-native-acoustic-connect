# Native Implementation for Dialog Event Tracking

This document summarizes the native implementation of the dialog event tracking functionality for both Android and iOS platforms.

## Overview

The dialog event tracking system has been implemented across all three layers:
1. **TypeScript Interface** (`src/specs/react-native-acoustic-connect.nitro.ts`)
2. **Android Implementation** (`android/src/main/java/com/acousticconnectrn/HybridAcousticConnectRN.kt`)
3. **iOS Implementation** (`ios/HybridAcousticConnectRN.swift`)

## Interface Methods Added

Four new methods were added to the `AcousticConnectRN` interface:

### 1. `logDialogShowEvent`
- **Purpose**: Logs when a dialog is shown
- **Parameters**: 
  - `dialogId`: Unique identifier for the dialog
  - `dialogTitle`: The title of the dialog
  - `dialogType`: The type of dialog (alert, custom, modal)
- **Returns**: `Boolean` indicating success/failure

### 2. `logDialogDismissEvent`
- **Purpose**: Logs when a dialog is dismissed
- **Parameters**:
  - `dialogId`: Unique identifier for the dialog
  - `dismissReason`: The reason for dismissing the dialog
- **Returns**: `Boolean` indicating success/failure

### 3. `logDialogButtonClickEvent`
- **Purpose**: Logs when a button in a dialog is clicked
- **Parameters**:
  - `dialogId`: Unique identifier for the dialog
  - `buttonText`: The text of the clicked button
  - `buttonIndex`: The index of the clicked button
- **Returns**: `Boolean` indicating success/failure

### 4. `logDialogCustomEvent`
- **Purpose**: Logs custom dialog events with additional data
- **Parameters**:
  - `dialogId`: Unique identifier for the dialog
  - `eventName`: The name of the custom event
  - `values`: A map of values associated with the event
- **Returns**: `Boolean` indicating success/failure

## Android Implementation

### File: `android/src/main/java/com/acousticconnectrn/HybridAcousticConnectRN.kt`

All four methods have been implemented using the existing `Connect.logCustomEvent()` API:

```kotlin
override fun logDialogShowEvent(dialogId: String, dialogTitle: String, dialogType: String): Boolean {
    var result = false
    try {
        val values = HashMap<String?, String?>()
        values["dialogId"] = dialogId
        values["dialogTitle"] = dialogTitle
        values["dialogType"] = dialogType
        values["eventType"] = "dialog_show"
        values["timestamp"] = System.currentTimeMillis().toString()
        
        result = Connect.logCustomEvent("DialogShowEvent", values, EOMonitoringLevel.kEOMonitoringLevelInfo.value)
    } catch (e: Exception) {
        println("Error logging dialog show event: ${e.message}")
        result = false
    }
    return result
}
```

### Key Features:
- **Error Handling**: All methods include try-catch blocks for robust error handling
- **Consistent Logging**: Uses the same `Connect.logCustomEvent()` API as other events
- **Timestamp**: Includes millisecond timestamps for event tracking
- **Event Type**: Each event includes an `eventType` field for easy filtering
- **Monitoring Level**: Uses `EOMonitoringLevel.kEOMonitoringLevelInfo.value` for consistent logging level

## iOS Implementation

### File: `ios/HybridAcousticConnectRN.swift`

All four methods have been implemented using the existing `ConnectCustomEvent().logEvent()` API:

```swift
func logDialogShowEvent(dialogId: String, dialogTitle: String, dialogType: String) throws -> Bool {
    let values: [String: Any] = [
        "dialogId": dialogId,
        "dialogTitle": dialogTitle,
        "dialogType": dialogType,
        "eventType": "dialog_show",
        "timestamp": String(Int(Date().timeIntervalSince1970 * 1000))
    ]
    
    let result = ConnectCustomEvent().logEvent("DialogShowEvent", values: values, level: kConnectMonitoringLevelType.connectMonitoringLevelInfo)
    return result
}
```

### Key Features:
- **Error Handling**: Uses Swift's throwing mechanism for error handling
- **Consistent Logging**: Uses the same `ConnectCustomEvent().logEvent()` API as other events
- **Timestamp**: Includes millisecond timestamps for event tracking
- **Event Type**: Each event includes an `eventType` field for easy filtering
- **Monitoring Level**: Uses `kConnectMonitoringLevelType.connectMonitoringLevelInfo` for consistent logging level
- **Type Safety**: Leverages Swift's strong typing for parameter validation

## Generated Spec Files

The Nitro framework automatically generated the interface specifications:

### Android: `nitrogen/generated/android/kotlin/com/margelo/nitro/acousticconnectrn/HybridAcousticConnectRNSpec.kt`
- Contains abstract method declarations for all four dialog event methods
- Properly annotated with `@DoNotStrip` and `@Keep` for ProGuard compatibility

### iOS: `nitrogen/generated/ios/swift/HybridAcousticConnectRNSpec.swift`
- Contains protocol method declarations for all four dialog event methods
- Includes proper Swift documentation comments

## Data Structure

All dialog events include consistent metadata:

```json
{
  "dialogId": "unique_dialog_identifier",
  "eventType": "dialog_show|dialog_dismiss|dialog_button_click|dialog_custom_event",
  "timestamp": "1703123456789",
  // Additional fields specific to each event type
}
```

## Error Handling Strategy

### Android:
- Uses try-catch blocks to prevent app crashes
- Logs error messages to console for debugging
- Returns `false` on any exception

### iOS:
- Uses Swift's throwing mechanism
- Errors are propagated up the call stack
- Caller can handle errors appropriately

## Performance Considerations

- **Lightweight**: All methods are lightweight and don't perform heavy operations
- **Async Safe**: Methods can be called from any thread
- **Memory Efficient**: Uses simple data structures and minimal memory allocation
- **Network Efficient**: Events are batched and sent according to existing Connect SDK policies

## Testing

The implementation can be tested using:

1. **Unit Tests**: Test individual method calls
2. **Integration Tests**: Test with actual dialog components
3. **End-to-End Tests**: Verify events appear in Acoustic Connect dashboard

## Future Enhancements

Potential improvements for future versions:

1. **Event Batching**: Batch multiple dialog events for better performance
2. **Custom Event Types**: Allow developers to define custom dialog event types
3. **Event Filtering**: Add configuration options to filter specific dialog events
4. **Analytics Integration**: Direct integration with analytics platforms
5. **Performance Metrics**: Track dialog performance metrics (show time, interaction time)

## Compatibility

- **Backward Compatible**: No breaking changes to existing functionality
- **Platform Agnostic**: Consistent API across Android and iOS
- **Framework Compatible**: Works with existing Connect SDK infrastructure
- **Version Safe**: Compatible with current React Native versions 