/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
********************************************************************************************/

import { Keyboard, Platform, TextInput } from "react-native";
import TLTRN from '../TLTRN';

class KeyboardListener {
    static TLTRN: TLTRN | null = null;
    static listener: KeyboardListener | null = null;

    static _instance(_TLTRN: TLTRN): KeyboardListener {
        if (!KeyboardListener.listener) {
            KeyboardListener.listener = new KeyboardListener(_TLTRN);
        }
        return KeyboardListener.listener;
    }

    enabled: boolean;

    constructor(_TLTRN: TLTRN) {
        KeyboardListener.TLTRN = _TLTRN;

        this.enabled = false;
        let _x: Record<string, any> = {};
        let _i: Record<string, any> = {};

        const sanitize = (target: string, text: string): string => {
            if (!_x[target].secureTextEntry || typeof _x[target].secureTextEntry === "undefined") {
                return text;
            }
            return new Array(text.length).fill("*").join("");
        };

        const flushData = (): void => {
            _i = {};
            _x = {};
        };

        const keyListener = (evt: any, bubbledEvent: string): void => {
            let _nativeTag = evt?.target?._nativeTag;

            let valid = this.enabled && (!_i[_nativeTag] || _i[_nativeTag] === bubbledEvent);
            if (!valid) {
                return;
            }

            _i[_nativeTag] = bubbledEvent;
            if (!_x[_nativeTag]) {
                _x[_nativeTag] = { text: "" };
            }

            _x[_nativeTag].target = evt?.target?._nativeTag;
            _x[_nativeTag].controlId = evt?._targetInst?.memoizedProps?.id;
            _x[_nativeTag].ariaLabel = evt?._targetInst?.memoizedProps?.accessible?.accessibilityLabel;
            _x[_nativeTag].secureTextEntry = evt?._targetInst?.memoizedProps?.secureTextEntry;

            const anon = (_k: string): string => {
                if (_k !== "Backspace" && _k.length === 1) {
                    return (_x[_nativeTag].text += sanitize(_nativeTag, _k));
                } else if (_k !== "Backspace" && _k.length > 1) {
                    return sanitize(_nativeTag, _k);
                } else {
                    return _x[_nativeTag].text.slice(0, -1);
                }
            };

            let text: string | null = null;
            switch (bubbledEvent) {
                case "onTextInput":
                    text = evt?.nativeEvent?.text;
                    _x[_nativeTag].text = sanitize(_nativeTag, text || "");
                    break;
                case "onKeyPress":
                    text = evt?.nativeEvent?.key;
                    _x[_nativeTag].text = anon(text || "");
                    break;
                case "onChange":
                    text = evt?.nativeEvent?.text;
                    _x[_nativeTag].text = sanitize(_nativeTag, text || "");
                    break;
            }
        };

        const keyboardDidHide = async (): Promise<void> => {
            let values = Object.values(_x);
            for (let value of values) {
                let { text, controlId, ariaLabel, target } = value;
                TLTRN.logTextChangeEvent(target, controlId, text, ariaLabel);
            }
            flushData();
        };

        // @ts-ignore: Ignore TypeScript error for defaultProps
        TextInput.defaultProps = TextInput.defaultProps || {};
        // @ts-ignore: Ignore TypeScript error for defaultProps
        TextInput.defaultProps.onChange = (evt: any) => keyListener(evt, "onChange");

        Keyboard.addListener("keyboardDidHide", keyboardDidHide);
    }

    interceptKeyboardEvents(enable: boolean): void {
        this.enabled = enable;
    }
}

export default KeyboardListener;