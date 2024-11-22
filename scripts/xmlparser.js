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
const xmlPaserPlugin = require("@prettier/plugin-xml");
const { exit } = require('process');
const { isValid } = require('./util');

console.log("Run xmlParser.js");

const directoryPath = path.join(__dirname,"..","..","..")
if(!isValid(`${directoryPath}/android`)){
  console.log("Directory not valid:")
  console.log(`${directoryPath}/android`)
  exit(0)
}

const filePath = `${directoryPath}/android/app/src/main/AndroidManifest.xml`;
const permssions = ['android.permission.INTERNET',
'android.permission.ACCESS_NETWORK_STATE',
'android.permission.ACCESS_WIFI_STATE',
'android.permission.ACCESS_FINE_LOCATION']

try {
   xmlData = fs.readFileSync(filePath, 'utf8');
   let result = prettier.format(xmlData, {
    parser: "xml",
    plugins: [xmlPaserPlugin],
    tabWidth: 2,
  });
  
  let build =">\n"

  count = 0
  permssions.forEach(permssion =>{
    if (!result.includes(permssion)){
      build = build + `<uses-permission android:name="${permssion}"/>\n`
      count++
    }
  })
  
  result = result.replace(">" , build)
  
  result = prettier.format(result, {
    parser: "xml",
    plugins: [xmlPaserPlugin],
    tabWidth: 2,
  });


  if( count > 0){
    fs.writeFileSync(filePath, result);
  }
 

} catch (err) {
  console.error(err);
}
