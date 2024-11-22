adb shell ps | grep $1 || [ $? -eq 1 ]
