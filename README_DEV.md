# How to add a new api for react native module for iOS and Android

Go to `src/specs/react-native-acoustic-connect.nitro.ts`

You need to add typescripe syntax which will expose an interface which can be implemented in swift for iOS and kotlin for Android.

Then you will need to run 
```
npm run rebuild
```
which will update react native module and also update the example application to test that all builds correctly.


# What is yalc?

It is used to deploy npm local builds to your local machine and then you can use it to test it locally. For more information, https://github.com/wclr/yalc

To start install use:
```
npm i yalc -g
```

To use need to publish to local machine
```
yalc publish
```

To add to a project to use
```
yalc add react-native-acoustic-connect
```

# Test applications
All have been tested using npm install.

## example

This is used to check that basic react native application.

## Examples/AwesomeProjectWithoutFramework_0_76_9

This is used to check that basic react native application with 0.76.9.

## Examples/AwesomeProjectWithoutFramework_0_76_9_yalc

This is used to check that basic react native application with 0.76.9 using local with yalc.

## Examples/SampleUI

This is our new demo react native application from https://github.com/callstack/react-native-paper.

## Examples/SampleUI_yalc

This is our new demo react native application from https://github.com/callstack/react-native-paper using local with yalc.
