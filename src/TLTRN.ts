/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

// @ts-ignore
import MessageQueue from "react-native/Libraries/BatchedBridge/MessageQueue.js";
import { Platform } from "react-native";
import KeyboardListener from "./utils/KeyboardListener";
import DialogListener from "./utils/DialogListener";
import type { DialogEvent, DialogButtonClickEvent, DialogDismissEvent } from "./utils/DialogListener";
import AcousticConnectRN from './index'; 

// Preserve any previously-installed handler (e.g. React Native's red-box
// handler) so we augment rather than replace it.
// @ts-ignore
const previousGlobalErrorHandler = global.ErrorUtils?.getGlobalHandler?.();

// @ts-ignore
global.ErrorUtils?.setGlobalHandler?.((e: any, isFatal: boolean) => {
  // A global error handler must never throw — otherwise it masks the ORIGINAL
  // error. `AcousticConnectRN` can be undefined here (e.g. the native module
  // failed to load, or during the module-load circular import), so guard the
  // call and always forward to the previous handler so the real error still
  // surfaces and fatals still crash.
  try {
    AcousticConnectRN?.logExceptionEvent?.(
        JSON.stringify(e),
        JSON.stringify(e),
        true
    );
  } catch (loggingError: Error | any) {
    console.warn('TLTRN: failed to log uncaught exception:', loggingError?.message);
  } finally {
    previousGlobalErrorHandler?.(e, isFatal);
  }
});

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
  static displayDebug = false;

  static myTimer = {
    handle: null as NodeJS.Timeout | null,
    started: 0,
    time: 1000,
    /**
     * @type Class
     */
    startTimer: function () {
      this.started = 1;
      this.handle = setInterval(TLTRN.checkTime, this.time);
    },
    /**
     * @type Class
     */
    stopTimer: function () {
      if (this.handle) {
        clearInterval(this.handle);
        this.handle = null;
        this.started = 0;
      }
    },
  };
  
  static init = (initialCurrentScreen: String, showDebugConsoleMessages: boolean) => {
    TLTRN.currentScreen =
      initialCurrentScreen === undefined
        // @ts-ignore:
        ? currentScreenMsg
        : initialCurrentScreen;
    MessageQueue.spy(TLTRN.listenToBridge);
    TLTRN.displayDebug = showDebugConsoleMessages === undefined ? false : showDebugConsoleMessages;
  };

  static interceptKeyboardEvents = (enable: boolean) => {
    keyListener.interceptKeyboardEvents(enable);
  };

  static logScreenViewPageName = (name: string | undefined) => {
    let result = false
    try {
      result = AcousticConnectRN.setCurrentScreenName(name || '');
    } catch (error: Error | any) {  
      console.log('LogScreenViewPageName error: ', error.message);
    }
    return result;
  };

  static logScreenViewContextLoad = (name: string, prevName: string) => {
    let result = false
    try {
      result = AcousticConnectRN.logScreenViewContextLoad(name, prevName);
    } catch (error: Error | any) {
      console.log('LogScreenViewContextLoad error: ', error.message);
    }
    return result;
  };

  static logScreenLayout = (name: string | undefined) => {
    TLTRN.currentScreen = name || '';
    let result = false
    try {
      result = AcousticConnectRN.logScreenLayout(TLTRN.currentScreen, 0);
    } catch (error: Error | any) {
      console.log('LogScreenLayout error: ', error.message);
    }
    return result;
  };

  static logClickEvent = async (event: any) => {
    let result = false

    // Fabric exposes the host tag as `__nativeTag` (double underscore).
    // Paper used `_nativeTag` (single). Read both for safety.
    const target = event?.target?.__nativeTag ?? event?.target?._nativeTag;
    if (target == null) {
      return result;
    }

    // controlId comes from the touched view's `id` prop. Fiber internals can
    // vary across React versions, so guard each access.
    let controlId = '';
    try {
      const fiberId = event?._targetInst?.memoizedProps?.id;
      if (typeof fiberId === 'string' && fiberId.length > 0) {
        controlId = fiberId;
      } else if (Array.isArray(event?._dispatchInstances)) {
        const found = event._dispatchInstances.find(
          (node: any) => node?.memoizedProps?.id
        );
        if (found) controlId = found.memoizedProps.id;
      }
    } catch {}

    try {
      result = AcousticConnectRN.logClickEvent(target, controlId);
    } catch (error: Error | any) {
      console.log('LogClickEvent error: ', error.message);
    }
    return result;
  };

  static logTextChangeEvent = async (target: number, controlId: string, text: string, _ariaLabel: string) => {
    let result = false
    try {
        if (Platform.OS === 'ios') {
          result = AcousticConnectRN.logTextChangeEvent(target, controlId, text);
        } else if (Platform.OS === 'android') {
          AcousticConnectRN.logTextChangeEvent(target, controlId, text);
        }
    } catch (error: Error | any) {
      console.log('LogTextChangeEvent error: ', error.message);
    }
    return result;
  };
  
  static logCustomEvent = async (eventName: string, values: Record<string, string | number | boolean>, level: number) => {
    let result = false
    try {
      result = AcousticConnectRN.logCustomEvent(eventName, values, level);
    } catch (error: Error | any) {
      console.log('LogCustomEvent error: ', error.message);
    }
    return result;
  };

  // New dialog event logging methods
  static logDialogShowEvent = async (dialogId: string, dialogTitle: string, dialogType: string) => {
    let result = false
    try {
      result = AcousticConnectRN.logDialogShowEvent(dialogId, dialogTitle, dialogType);
    } catch (error: Error | any) {
      console.log('LogDialogShowEvent error: ', error.message);
    }
    return result;
  };

  static logDialogDismissEvent = async (dialogId: string, dismissReason: string) => {
    let result = false
    try {
      result = AcousticConnectRN.logDialogDismissEvent(dialogId, dismissReason);
    } catch (error: Error | any) {
      console.log('LogDialogDismissEvent error: ', error.message);
    }
    return result;
  };

  static logDialogButtonClickEvent = async (dialogId: string, buttonText: string, buttonIndex: number) => {
    let result = false
    try {
      result = AcousticConnectRN.logDialogButtonClickEvent(dialogId, buttonText, buttonIndex);
    } catch (error: Error | any) {
      console.log('LogDialogButtonClickEvent error: ', error.message);
    }
    return result;
  };

  static logDialogCustomEvent = async (dialogId: string, eventName: string, values: Record<string, string | number | boolean>) => {
    let result = false
    try {
      result = AcousticConnectRN.logDialogCustomEvent(dialogId, eventName, values);
    } catch (error: Error | any) {
      console.log('LogDialogCustomEvent error: ', error.message);
    }
    return result;
  };

  // Dialog event interceptor methods
  static eventListenerRegistered = false;
  static eventListenerUnsubscribe: (() => void) | null = null;
  
  static interceptDialogEvents = (enable: boolean) => {
    const dialogListener = DialogListener.getInstance();
    
    if (enable && !TLTRN.eventListenerRegistered) {
      dialogListener.startIntercepting();
      TLTRN.eventListenerUnsubscribe = dialogListener.addEventListener((event: DialogEvent | DialogButtonClickEvent | DialogDismissEvent) => {
        if ('buttonText' in event) {
          // This is a button click event
          TLTRN.logDialogButtonClickEvent(event.dialogId, event.buttonText, event.buttonIndex);
        } else if ('dismissReason' in event) {
          // This is a dialog dismiss event
          TLTRN.logDialogDismissEvent(event.dialogId, event.dismissReason);
        } else {
          // This is a dialog show event
          TLTRN.logDialogShowEvent(event.dialogId, event.dialogTitle, event.dialogType);
        }
      });
      TLTRN.eventListenerRegistered = true;
    } else if (!enable && TLTRN.eventListenerRegistered) {
      dialogListener.stopIntercepting();
      if (TLTRN.eventListenerUnsubscribe) {
        TLTRN.eventListenerUnsubscribe();
        TLTRN.eventListenerUnsubscribe = null;
      }
      TLTRN.eventListenerRegistered = false;
    }
  };

  static listenToBridge = (message: any) => {
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
      TLTRN.myTimer.startTimer();
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
      try {
        AcousticConnectRN?.logExceptionEvent?.(
          message.args[0],
          JSON.stringify(message.args[1]),
          true
        );
      } catch (error: Error | any) {
        console.log('logExceptionEvent (bridge) error: ', error?.message);
      }
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
      TLTRN.myTimer.stopTimer();
      this.logTeal();
    }
  };

  static logTeal = async () => {
    try {
      TLTRN.isLoggingData = 1;
      var res = await AcousticConnectRN.logScreenLayout(TLTRN.currentScreen, -1);
      var dict = { ReactLayoutTime: TLTRN.totalRenderTime };
      var result = await AcousticConnectRN.logCustomEvent("ReactPlugin", dict, 1);
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
