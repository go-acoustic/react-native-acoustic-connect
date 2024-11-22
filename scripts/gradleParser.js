/********************************************************************************************
* Copyright (C) 2024 Acoustic, L.P. All rights reserved.
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

if(!isValid(`${directoryPath}/android`)){
  console.log("Directory not valid:")
  console.log(`${directoryPath}/android`)
  exit(0)
}

const gradleCode = `apply from: project(':react-native-acoustic-connect').projectDir.getPath() + "/config.gradle"`

let gradleData = '';
try {
  const filePath = `${directoryPath}/android/app/build.gradle`
    gradleData = fs.readFileSync(filePath, 'utf8');
    const re = new RegExp(/react-native-acoustic-connect/, "g");
    const found = re.test(gradleData);
    if(!found){
        gradleData = `${gradleData}\n${gradleCode}\n`
        fs.writeFileSync(filePath, gradleData);
    }
  
} catch (err) {
  console.error(err);
}
