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
 * Verify and Update React Native SDK integration to capture screen tracking.
 * 
 * cd node_modules/react-native-acoustic-connect folder
 * 
 * yarn run verifyConnectSetup
 * 
 */
const fs = require('fs');

//const filePath = "../../src/components/RootComponent.tsx"
const filePath = "Example/nativebase-v3-kitchensink/src/components/RootComponent.tsx"

function log(message) {
    console.log(message);
}

function isRootFileAvailable() {
    return fs.existsSync(filePath);
}

function isConnectComponentAvailable() {
    log("Looking for Connect tag...");
    return isComponentAvailable(/<Connect/);
}

function isNavigationContainerAvailable() {
    log("Looking for NavigationContainer tag...");
    return isComponentAvailable(/<NavigationContainer/);
}

function isComponentAvailable(componentTag) {
    try {
        let data = fs.readFileSync(filePath, 'utf8');
        const re = new RegExp(componentTag, "g");
        const found = re.test(data);

        return found;
    } catch (err) {
        console.error(err);
    }
}

if (isRootFileAvailable()) {
    if (isConnectComponentAvailable()) {
        log("Connect component found. You are ready to go!");
    } else if (isNavigationContainerAvailable()) {
        log("NavigationContainer component is available but Connect component is missing.\n I'll add Connect around NavigationContainer component.");
        AddConnectComponent();
    } else {
        log("Missing both Connect and NavigationContainer component.\n Please refer to SDK integration without React Navigation.");
    };
} else {
    console.error("App.js file not found in root app folder.");
}

// Update and add Connect around NavigationContainer
function AddConnectComponent() {
    const connectImport = `import { Connect } from 'react-native-acoustic-connect';`

    const startNavigationContainer = /<NavigationContainer/
    const startConnectComponent = `<Connect><NavigationContainer`

    const endNavigationContainer = /<\/NavigationContainer>/
    const endConnectComponent = `</NavigationContainer></Connect>`
    
    try {
        let data = fs.readFileSync(filePath, 'utf8');
        data = data
            .replace(startNavigationContainer, startConnectComponent)
            .replace(endNavigationContainer, endConnectComponent);
        fs.writeFileSync(filePath, ConnectImport + '\n' + data);
    } catch (err) {
        log("Something went wrong.\n Please refer to SDK integration with React Navigation.");
        console.error(err);
    }
}
