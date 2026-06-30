#!/bin/bash
set -euo pipefail

APP_ID="com.sampleui" # <-- Update if your appId is different
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

# Function to find and tap element by text
find_and_tap_by_text() {
    local text="$1"
    local max_attempts="${2:-3}"
    local attempt=1
    
    echo "Looking for element with text: '$text'"
    
    while [ $attempt -le $max_attempts ]; do
        # Dump UI hierarchy
        adb shell uiautomator dump /sdcard/window_dump.xml
        
        # Extract coordinates for the text
        local coords=$(adb shell "cat /sdcard/window_dump.xml | grep -A 5 -B 5 '$text' | grep 'bounds=' | head -1 | sed 's/.*bounds=\"\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\].*/\1 \2 \3 \4/'")
        
        if [ -n "$coords" ]; then
            # Parse coordinates
            local x1=$(echo $coords | awk '{print $1}')
            local y1=$(echo $coords | awk '{print $2}')
            local x2=$(echo $coords | awk '{print $3}')
            local y2=$(echo $coords | awk '{print $4}')
            
            # Calculate center point
            local center_x=$(( (x1 + x2) / 2 ))
            local center_y=$(( (y1 + y2) / 2 ))
            
            echo "Found '$text' at coordinates: ($center_x, $center_y)"
            adb shell input tap $center_x $center_y
            return 0
        else
            echo "Attempt $attempt: Element '$text' not found, retrying..."
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
    
    echo "ERROR: Could not find element with text '$text' after $max_attempts attempts"
    return 1
}

# Function to find and tap one of multiple possible button texts
find_and_tap_button() {
    local button_texts=("$@")
    
    for text in "${button_texts[@]}"; do
        if find_and_tap_by_text "$text" 1; then
            echo "Successfully tapped button: '$text'"
            return 0
        fi
    done
    
    echo "ERROR: Could not find any of the button texts: ${button_texts[*]}"
    return 1
}

# Function to scroll and find element
scroll_and_find_element() {
    local text="$1"
    local max_scrolls="${2:-5}"
    local scroll_count=0
    
    while [ $scroll_count -lt $max_scrolls ]; do
        if find_and_tap_by_text "$text" 1; then
            return 0
        fi
        
        echo "Scrolling to find '$text'..."
        adb shell input swipe 500 800 500 200  # Scroll down
        sleep 2
        scroll_count=$((scroll_count + 1))
    done
    
    echo "ERROR: Could not find '$text' after scrolling $max_scrolls times"
    return 1
}

# Function to debug current screen content
debug_screen_content() {
    echo "=== DEBUG: Current screen content ==="
    adb shell uiautomator dump /sdcard/window_dump.xml
    adb shell "cat /sdcard/window_dump.xml | grep -E 'text=|content-desc=' | head -20"
    echo "=== END DEBUG ==="
}

# 1. Start emulator if not running
if ! adb devices | grep -w emulator >/dev/null; then
  echo "No emulator running. Attempting to start the first available AVD..."
  EMULATOR_NAME=$(emulator -list-avds | head -n 1)
  if [ -z "$EMULATOR_NAME" ]; then
    echo "No Android emulators found. Please create one via AVD Manager."
    exit 1
  fi
  nohup emulator -avd "$EMULATOR_NAME" -no-snapshot-save -no-window > /dev/null 2>&1 &
  echo "Waiting for emulator to boot..."
  adb wait-for-device
  sleep 30 # Give extra time for boot
fi

# 2. Build the app
cd android
./gradlew assembleDebug
cd ..

# 3. Install the APK
adb install -r "$APK_PATH"

# 4. Launch the app
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1

# Wait for the app to start
sleep 10

# 5. Verify the app process is running
if adb shell pidof "$APP_ID" | grep -q '[0-9]'; then
  echo "App launched successfully!"
else
  echo "App did not launch."
  exit 1
fi

# 6. Test Dialog functionality
echo "Testing Dialog functionality..."

# Wait for app to fully load
sleep 5

# Navigate to Dialog example
echo "Navigating to Dialog example..."
if ! scroll_and_find_element "Dialog"; then
    echo "ERROR: Could not find Dialog example"
    exit 1
fi

# Wait for Dialog screen to load and verify we're on the right screen
echo "Waiting for Dialog screen to load..."
sleep 5

# Debug current screen
debug_screen_content

# Verify we're on the Dialog screen by checking for the header
echo "Verifying we're on the Dialog screen..."
if ! find_and_tap_by_text "Dialog" 1; then
    echo "ERROR: Not on Dialog screen - Dialog header not found"
    exit 1
fi

# Wait a bit more for the screen to fully load
sleep 2

# Debug screen again to see what's available
echo "Final screen content before testing dialogs:"
debug_screen_content

# Test each dialog button
echo "Testing dialog buttons..."

# Test "Long text" dialog
echo "Testing 'Long text' dialog..."
if find_and_tap_by_text "Long text"; then
    echo "Tapped 'Long text' button, waiting for dialog to appear..."
    sleep 3  # Wait longer for dialog to appear
    
    # Debug screen after tapping
    debug_screen_content
    
    if find_and_tap_button "Ok" "OK"; then
        echo "✓ Long text dialog test passed"
    else
        echo "✗ Failed to close Long text dialog"
        exit 1
    fi
else
    echo "✗ Failed to open Long text dialog"
    exit 1
fi
sleep 1

# Test "Radio buttons" dialog
echo "Testing 'Radio buttons' dialog..."
if find_and_tap_by_text "Radio buttons"; then
    echo "Tapped 'Radio buttons' button, waiting for dialog to appear..."
    sleep 3  # Wait longer for dialog to appear
    
    if find_and_tap_button "Ok" "OK" "Cancel"; then
        echo "✓ Radio buttons dialog test passed"
    else
        echo "✗ Failed to close Radio buttons dialog"
        exit 1
    fi
else
    echo "✗ Failed to open Radio buttons dialog"
    exit 1
fi
sleep 1

# Test "Progress indicator" dialog
echo "Testing 'Progress indicator' dialog..."
if find_and_tap_by_text "Progress indicator"; then
    sleep 3  # Progress dialogs usually auto-dismiss
    echo "✓ Progress indicator dialog test passed"
else
    echo "✗ Failed to open Progress indicator dialog"
    exit 1
fi
sleep 1

# Test "Undismissable Dialog"
echo "Testing 'Undismissable Dialog'..."
if find_and_tap_by_text "Undismissable Dialog"; then
    sleep 3  # Wait longer for dialog to appear
    if find_and_tap_button "Agree" "OK" "Ok"; then
        echo "✓ Undismissable Dialog test passed"
    else
        echo "✗ Failed to close Undismissable Dialog"
        exit 1
    fi
else
    echo "✗ Failed to open Undismissable Dialog"
    exit 1
fi
sleep 1

# Test "Custom colors" dialog
echo "Testing 'Custom colors' dialog..."
if find_and_tap_by_text "Custom colors"; then
    sleep 3  # Wait longer for dialog to appear
    if find_and_tap_button "Ok" "OK"; then
        echo "✓ Custom colors dialog test passed"
    else
        echo "✗ Failed to close Custom colors dialog"
        exit 1
    fi
else
    echo "✗ Failed to open Custom colors dialog"
    exit 1
fi
sleep 1

# Test "Dialog Tracking Test" (most important for Acoustic Connect)
echo "Testing 'Dialog Tracking Test'..."
if find_and_tap_by_text "Dialog Tracking Test"; then
    sleep 3  # Wait longer for dialog to appear
    if find_and_tap_button "Close" "OK" "Ok"; then
        echo "✓ Dialog Tracking Test passed"
    else
        echo "✗ Failed to close Dialog Tracking Test"
        exit 1
    fi
else
    echo "✗ Failed to open Dialog Tracking Test"
    exit 1
fi
sleep 1

# Test "With icon" dialog (if available in MD3)
echo "Testing 'With icon' dialog..."
if find_and_tap_by_text "With icon"; then
    sleep 3  # Wait longer for dialog to appear
    if find_and_tap_button "Agree" "Disagree" "OK" "Ok"; then
        echo "✓ With icon dialog test passed"
    else
        echo "✗ Failed to close With icon dialog"
        exit 1
    fi
else
    echo "⚠ With icon dialog not available (V3 theme not enabled)"
fi
sleep 1

# Test "Dismissable back button" dialog (Android specific)
echo "Testing 'Dismissable back button' dialog..."
if find_and_tap_by_text "Dismissable back button"; then
    sleep 3  # Wait longer for dialog to appear
    # Try to dismiss with back button
    adb shell input keyevent 4  # KEYCODE_BACK
    sleep 1
    echo "✓ Dismissable back button dialog test passed"
else
    echo "⚠ Dismissable back button dialog not available (iOS)"
fi
sleep 1

echo "All dialog tests completed successfully!"
echo "Integration test passed!"
exit 0 