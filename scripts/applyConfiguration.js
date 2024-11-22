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
 * Set Connect configuration values from cmd arguments to configuration 'ConnectConfig.json' file.
 * 
 * cd node_modules/react-native-acoustic-connect folder
 * 
 * yarn run applyConfiguration --AppKey=<your_app_key> --PostMessageUrl=<your_post_url>
 * 
 */
const fs = require("fs");

const AppKey = "AppKey"
const PostMessageUrl = "PostMessageUrl"
const filePath = "../../ConnectConfig.json"

function log(message) {
    console.log(message);
}

function getConfigValuesFromArguments() {
    var configObject = {
        AppKey: null,
        PostMessageUrl: null
    }

    var args = process.env.npm_config_argv;
    var originalArgs = JSON.parse(args).original;
    originalArgs.forEach(function (arg) {
        if (arg.includes(AppKey)) {
            configObject.AppKey = arg.split('=')[1];
            log(AppKey + " found: "+ configObject.AppKey);
        }
        if (arg.includes(PostMessageUrl)) {
            configObject.PostMessageUrl = arg.split('=')[1];
            log(PostMessageUrl + " found: "+ configObject.PostMessageUrl);
        }
    });

    return configObject;
}

function findCurrentConfigValues(configObject) {
    if (!fs.existsSync(filePath)) {
        console.error("'ConnectConfig.json' file not found in root app folder.");
        return;
    }
    
    try {
        fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (data) {
                var currentConfigObject = JSON.parse(data);
                setConfigValuesToFile(configObject, currentConfigObject);
            }
        });
    } catch (err) {
        console.error("Permission denied: 'ConnectConfig.json' file");
        throw new Error("permission denied");
    }
}

function setConfigValuesToFile(configObject, currentConfigObject) {
    if (currentConfigObject) {
        if (currentConfigObject.Connect[AppKey]) {
            log("AppKey already set: " + currentConfigObject.Connect[AppKey]);
            if (configObject.AppKey) {
                log("Update AppKey to: " + configObject.AppKey);
                currentConfigObject.Connect[AppKey] = configObject.AppKey;
            }
        }
        else {
            log("Set " + AppKey + " to: " + configObject.AppKey);
            currentConfigObject.Connect[AppKey] = configObject.AppKey;
        }

        if (currentConfigObject.Connect[PostMessageUrl]) {
            log("PostMessageUrl already set: " + currentConfigObject.Connect[PostMessageUrl]);
            if (configObject.PostMessageUrl) {
                log("Update PostMessageUrl to: " + configObject.PostMessageUrl);
                currentConfigObject.Connect[PostMessageUrl] = configObject.PostMessageUrl;
            }
        }
        else {
            log("Set " + PostMessageUrl + " to: " + configObject.PostMessageUrl);
            currentConfigObject.Connect[PostMessageUrl] = configObject.PostMessageUrl;
        }

        var json = JSON.stringify(currentConfigObject, null, 2);
        const textContent = json;
        fs.writeFileSync(filePath, textContent);
    }
}

log("Acoustic Connect SDK installed, Looking for Connect config values: AppKey and PostMessageUrl");
var configObject = getConfigValuesFromArguments();
findCurrentConfigValues(configObject);
