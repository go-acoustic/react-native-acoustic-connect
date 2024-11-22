/********************************************************************************************
* Copyright (C) 2024 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

/**
 * Used review ConnectConfig.json is present ot will need to add one.
 */
const fs = require('fs');
const filePathBaseConnectConfig = "../../ConnectConfig.json"
const filePathTemplateConnectConfig = "scripts/ConnectConfig.json"

console.log("Run reviewConnectConfig.js");

if (fs.existsSync(filePathBaseConnectConfig)) {
    console.log("ConnectConfig found in your project. You are ready to go!");
} else {
    console.log("ConnectConfig not found in your project. I will add one.");
    fs.copyFile(filePathTemplateConnectConfig, filePathBaseConnectConfig, (err) => {
      if (err) throw err;
      console.log(filePathTemplateConnectConfig + ' was copied to ' + filePathBaseConnectConfig);
    });
}