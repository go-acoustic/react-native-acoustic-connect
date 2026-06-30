/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/
const fs = require('fs');
const path = require('path');
const { exit } = require('process');
const { isValid } = require('./util');
const directoryPath = path.join(__dirname,"..","..","..")

console.log("Run gradleParser.js");

// Resolve config.gradle via Node rather than a Gradle subproject lookup.
// `project(':react-native-acoustic-connect')` only works if RN
// autolinking registered a subproject with that exact name — which RN 0.82 +
// new architecture does not guarantee — and fails the Gradle sync with
// "Project with path ':react-native-acoustic-connect' could not be
// found" otherwise. `require.resolve` walks up node_modules from the Android
// rootDir and finds the package regardless of autolinking. See CA-144314.
const gradleCode = `apply from: new File(["node", "--print", "require.resolve('react-native-acoustic-connect/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/android/config.gradle"`
// Matches the legacy `apply from: project(':react-native-acoustic-connect')...`
// line so an existing integration is upgraded in place on the next install.
const legacyGradleCodeRe = /^.*apply from:\s*project\(':react-native-acoustic-connect'\).*config\.gradle".*$/m
const filePath = `${directoryPath}/android/app/build.gradle`

if(!isValid(filePath)){
  console.log("File not found, skipping:", filePath)
  exit(0)
}

let gradleData = '';
try {
    gradleData = fs.readFileSync(filePath, 'utf8');
    console.log("Read: " + filePath);
    console.log(gradleData);

    if (gradleData.includes(gradleCode)) {
        // Already integrated with the current (Node-resolved) form — no-op.
        console.log("config.gradle apply-from already present, skipping:", filePath)
    } else if (legacyGradleCodeRe.test(gradleData)) {
        // Upgrade an existing integration that still uses the brittle
        // project(':react-native-acoustic-connect') subproject lookup.
        gradleData = gradleData.replace(legacyGradleCodeRe, gradleCode)
        fs.writeFileSync(filePath, gradleData);
        console.log("Upgraded legacy config.gradle apply-from line in:", filePath)
    } else {
        gradleData = `${gradleData}\n${gradleCode}\n`
        fs.writeFileSync(filePath, gradleData);
        console.log("Added config.gradle apply-from line to:", filePath)
    }
  
} catch (err) {
  console.error(err);
}
