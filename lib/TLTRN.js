/********************************************************************************************
* Copyright (C) 2024 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import { NativeModules } from "react-native";
import MessageQueue from "react-native/Libraries/BatchedBridge/MessageQueue.js";
import KeyboardListener from "./utils/KeyboardListener";

const RNCxa = NativeModules.RNCxa;

global.ErrorUtils.setGlobalHandler( (e, isFatal) => {

  RNCxa.logExceptionEvent(
      JSON.stringify(e),
      JSON.stringify(e),
      true
    );
})



class TLTRN {
  static currentScreen =
    "***initialCurrentScreen not set in ConnectLogger constructor***";
  static lastJSBridgeMessageTime = 0;
  static totalRenderTime = 0;
  static messageRenderTime = 0;
  static countMsgs = 0;
  static messageConsole = 0;
  static lastMessageConsole = 0;
  static isLoggingData = 0;
  static displayDebug = 0;

  static myTimer = {
    handle: 0,
    started: 0,
    time: 1000,
    start: function () {
      this.started = 1;
      this.handle = setInterval(TLTRN.checkTime, this.time);
    },
    stop: function () {
      if (this.handle) {
        clearInterval(this.handle);
        this.handle = 0;
        this.started = 0;
      }
    },
  };
  
  static init = (initialCurrentScreen, showDebugConsoleMessages) => {
    TLTRN.currentScreen =
      initialCurrentScreen === undefined
        ? currentScreenMsg
        : initialCurrentScreen;
    MessageQueue.spy(TLTRN.listenToBridge);
    TLTRN.displayDebug =
      showDebugConsoleMessages === undefined ? 0 : showDebugConsoleMessages;
  };

  static interceptKeyboardEvents = (enable) => {
    keyListener.interceptKeyboardEvents(enable);
  };

  static logScreenViewPageName = async (name) => {
    try {
      let response = await RNCxa.logScreenViewPageName(name);
      return response;
    } catch (error) {
      console.log('LogScreenViewPageName error: ', error.message);
    }
  };

  static logScreenViewContextLoad = async (name, prevName) => {
    try {
      let response = await RNCxa.logScreenViewContextLoad(name, prevName);
      return response;
    } catch (error) {
      console.log('LogScreenViewContextLoad error: ', error.message);
    }
  };

  static logScreenLayout = async (name) => {
    TLTRN.currentScreen = name;
    try {
      let response = await RNCxa.logScreenLayout(name, 0);
      return response;
    } catch (error) {
      console.log('LogScreenLayout error: ', error.message);
    }
  };

  static logClickEvent = async (event) => {    
    if(!event.target._nativeTag || typeof event.target._nativeTag === 'undefined'){ return false; }

    const events = event._dispatchInstances.filter(node => {
      return (node.memoizedProps &&  node.memoizedProps.id) 
    })
    const id = (events.length) ? events[0].memoizedProps.id : '';

    let target = event.target._nativeTag;
    let controlId = event._targetInst.memoizedProps.id !== undefined ? event._targetInst.memoizedProps.id : id;
    let ariaLabel = event._targetInst.memoizedProps.accessible !== undefined ? event._targetInst.memoizedProps.accessibilityLabel : '';

    try {
        if (Platform.OS === 'ios') {
          return await RNCxa.logClickEvent(target, controlId);
        } else if (Platform.OS === 'android') {
          return RNCxa.logClickEvent(target, controlId);
        }
    } catch(error){
      console.log('LogClickEvent error: ', error.message);
    }
  };

  static logTextChangeEvent = async (target, controlId, text, ariaLabel) => {
    try {
        if (Platform.OS === 'ios') {
          await RNCxa.logTextChangeEvent(target, controlId, text);
        } else if (Platform.OS === 'android') {
          RNCxa.logTextChangeEvent(target, controlId, text);
        }
    } catch (error) {
      console.log('LogTextChangeEvent error: ', error.message);
    }
  };
  
  static logCustomEvent = async (eventName, values, level) => {
    try {
      return await RNCxa.logCustomEvent(eventName, values, level);
    } catch (error) {
      console.log('LogCustomEvent error: ', error.message);
    }
  };

  static listenToBridge = (message) => {
    if (TLTRN.displayDebug) {
      console.log(
        "&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&:isLoggingData:" +
          TLTRN.isLoggingData
      );
    }
    if (TLTRN.isLoggingData == 1) {
      return;
    }

    var now = new Date().getTime();
    if (TLTRN.lastJSBridgeMessageTime === 0) {
      TLTRN.lastJSBridgeMessageTime = now;
    }

    if (TLTRN.messageConsole > 0) {
      TLTRN.lastMessageConsole = TLTRN.messageConsole;
    }
    TLTRN.messageConsole = now;
    TLTRN.countMsgs++;

    if (TLTRN.myTimer.started === 0) {
      TLTRN.myTimer.start();
    }

    TLTRN.messageRenderTime = now - TLTRN.lastJSBridgeMessageTime;
    TLTRN.totalRenderTime = TLTRN.totalRenderTime + TLTRN.messageRenderTime;
    if (TLTRN.displayDebug) {
      console.log(
        "*after:countMsgs: " +
          TLTRN.countMsgs +
          ":tTotal:" +
          TLTRN.totalRenderTime +
          ":messageDuration:" +
          TLTRN.messageRenderTime
      );
    }
    TLTRN.lastJSBridgeMessageTime = now;

    const from = message.type === 0 ? "N->JS" : "JS->N";
    const data =
      from +
      " : " +
      message.module +
      "." +
      message.method +
      "(" +
      JSON.stringify(message.args) +
      ")";

    if (TLTRN.displayDebug) {
      if (message.module !== "UIManager") {
        console.log("Message", message);
      }
      console.log("Message data:", data);
    }

    if (message.module === "ExceptionsManager") {
      RNCxa.logExceptionEvent(
        message.args[0],
        JSON.stringify(message.args[1]),
        true
      );
    }
  };

  static checkTime = () => {
    var now = new Date().getTime();
    if (TLTRN.displayDebug) {
      console.log(
        "======>Done compare total:" +
          TLTRN.totalRenderTime +
          " :lastMessageConsole:" +
          TLTRN.lastMessageConsole +
          ":now:" +
          now +
          ":diff:" +
          (now - TLTRN.lastMessageConsole) +
          ":" +
          (now - TLTRN.lastMessageConsole > 50)
      );
    }
    if (TLTRN.lastMessageConsole == 0) {
      return;
    }

    if (now - TLTRN.lastMessageConsole > 20) {
      if (TLTRN.displayDebug) {
        console.log("======>Done capture:" + new Date().getTime());
      }
      TLTRN.messageConsole = 0;
      TLTRN.lastMessageConsole = 0;
      TLTRN.myTimer.stop();
      logTeal();
    }
  };

  static logTeal = async () => {
    try {
      TLTRN.isLoggingData = 1;
      var res = await RNCxa.logScreenLayout(TLTRN.currentScreen);
      var dict = { ReactLayoutTime: TLTRN.totalRenderTime };
      var result = await RNCxa.logCustomEvent("ReactPlugin", dict, 1);
      if (TLTRN.displayDebug) {
        console.log(
          "======>logTeal:" +
            TLTRN.currentScreen +
            ":" +
            res +
            ":time:" +
            TLTRN.totalRenderTime
        );
      }
      TLTRN.isLoggingData = 0;
      TLTRN.lastJSBridgeMessageTime = 0;
      TLTRN.totalRenderTime = 0;
    } catch (e) {
      console.error(e);
    }
  };
}
const keyListener = KeyboardListener._instance(TLTRN);

export default TLTRN;
