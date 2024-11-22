/********************************************************************************************
* Copyright (C) 2024 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/
const prettier = require("prettier");
const fs = require("fs");
const path = require("path");
const javaPaserPlugin = require("prettier-plugin-java");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");
const { exit } = require("process");
const { isValid } = require('./util');
const directoryPath = path.join(__dirname, "..", "..", "..");

console.log("Run javaParser.js");

if (!isValid(`${directoryPath}/android`)) {
  console.log("Directory not valid:")
  console.log(`${directoryPath}/android`)
  exit(0);
}

function readFile(path) {
  let data = "";
  try {
    data = fs.readFileSync(path, "utf8");
    console.log("Read:" + path);
    // console.log(data);
  } catch (err) {
    console.log("Error reading:" + path);
    console.error(err);
  }
  return data;
}

const buildGradlePath = `${directoryPath}/android/app/build.gradle`;
console.log("Read build.gradle to get applicationId");
const buildGradleFile = readFile(buildGradlePath)

const regex = /applicationId.*/g;
const foundIt = buildGradleFile.match(regex);

let packageName = null
if (foundIt != null && foundIt[0] != null) {
  const singleQuote = foundIt[0].split("'");
  const doubleQuote = foundIt[0].split('"');
  if (singleQuote != null && singleQuote.length >= 2) {
    packageName = singleQuote[1];
  } else if (doubleQuote != null && doubleQuote.length >= 2) {
    packageName = doubleQuote[1];
  }
}

if (packageName == null) {
  const xmlFilePath = `${directoryPath}/android/app/src/main/AndroidManifest.xml`;
  console.log("Did not find it in " + buildGradlePath + ". I will look in " + xmlFilePath);
  const manifestFile = readFile(xmlFilePath)
  const options = {
    ignoreAttributes: false,
    format: true,
    preserveOrder: false,
  };
  const parser = new XMLParser(options);
  const jsonObj = parser.parse(manifestFile);
  packageName = jsonObj["manifest"]["@_package"];
}

console.log("Found the following applicationId:" + packageName);
if (packageName == null) {
  console.log("applicationId not found:")
  exit(0);
}

const upperJavaPath = packageName.replace(/\./g, "/");
const mainActivityPath = `${directoryPath}/android/app/src/main/java/${upperJavaPath}/MainActivity.java`;
const mainActivityFile = readFile(mainActivityPath)

const javaCode = `public boolean dispatchTouchEvent(MotionEvent e) {
                    Connect.INSTANCE.dispatchTouchEvent(this, e);
                    return super.dispatchTouchEvent(e);
                }`;
const upperJavaCode = `package ${packageName};`;
const javaCode2 = `${upperJavaCode}\nimport com.acoustic.connect.android.connectmod.Connect;`;
const javaCode3 = `Connect.INSTANCE.dispatchTouchEvent(this, e);
                   return super.dispatchTouchEvent(e);`;

// Setup to update file
let updateMainActivityData = prettier.format(mainActivityFile, {
  parser: "java",
  plugins: [javaPaserPlugin],
  tabWidth: 4,
});

let updateMainActivity = false;

// Look for dispatchTouchEvent method
const regExDispatchTouchEvent = new RegExp(/oolean dispatchTouchEvent/, "g");
if (!regExDispatchTouchEvent.test(updateMainActivityData)) {
  updateMainActivity = true;
  // Add dispatchTouchEvent method with library call
  updateMainActivityData = `${updateMainActivityData.substring(0, updateMainActivityData.length - 2)}${javaCode} }`;
}

// Check if our call has been added in dispatchTouchEvent
const regExConnectDispatchTouchEvent = new RegExp(/Connect.INSTANCE.dispatchTouchEvent/, "g");
if (!regExConnectDispatchTouchEvent.test(updateMainActivityData)) {
  updateMainActivity = true;
  // Add Connect.INSTANCE.dispatchTouchEvent
  updateMainActivityData = updateMainActivityData.replace(/return super.dispatchTouchEvent\(e\);/, javaCode3);
}

// Look for import
const regExImport = new RegExp("import com.acoustic.connect.android.connectmod.Connect", "g");
if(!regExImport.test(updateMainActivityData)){
  updateMainActivity = true;
  // Add import
  updateMainActivityData = updateMainActivityData.replace(upperJavaCode,javaCode2); 
}

// Update activity
if (updateMainActivity) {
    updateMainActivityData = prettier.format(updateMainActivityData, {
    parser: "java",
    plugins: [javaPaserPlugin],
    tabWidth: 4,
  });

  try {
    fs.writeFileSync(mainActivityPath, updateMainActivityData);
    console.log("Updated:" + mainActivityPath);
  } catch (err) {
    console.log("Error writing:" + mainActivityPath);
    console.error(err);
  }
} else {
  console.log("Update not needed for:" + mainActivityPath);
}
