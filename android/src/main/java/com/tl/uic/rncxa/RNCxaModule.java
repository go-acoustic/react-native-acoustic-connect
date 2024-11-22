//
// Copyright (C) 2024 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
// industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
// Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
// prohibited.
//

package com.tl.uic.rncxa;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.text.TextUtils;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.uimanager.UIManagerModule;
import com.ibm.eo.EOCore;
import com.ibm.eo.model.EOMonitoringLevel;
import com.acoustic.connect.android.connectmod.Connect;
import com.tl.uic.Tealeaf;
import com.tl.uic.model.ScreenviewType;
import com.tl.uic.util.LayoutUtil;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;


/**
 * Connect Android React-Native module that wraps API calls for Javascript.
 * How to use:
 */
public class RNCxaModule extends ReactContextBaseJavaModule implements LifecycleEventListener {

    private final ReactApplicationContext reactContext;
    private static final String E_LAYOUT_ERROR = "E_LAYOUT_ERROR";
    private static final String E_VIEW_NOT_FOUND_ERROR = "E_VIEW_NOT_FOUND_ERROR";

    public RNCxaModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.reactContext.addLifecycleEventListener(this);
    }

    @NonNull
    @Override
    public String getName() {
        return "RNCxa";
    }

    /**
     * Requests that the framework save the current application page name.
     *
     * @param logicalPageName Page name or title e.g. "Login View Controller"; Must not be empty.
     * @param promise         Javascript Promise interface.
     */
    @ReactMethod
    public void setCurrentScreenName(final String logicalPageName, final Promise promise) {
        boolean result = Connect.INSTANCE.resumeConnect(getCurrentActivity(), logicalPageName, false);
        updateResult(result, promise);
    }

    /**
     * Sets the module's boolean configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      Boolean Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void setBooleanConfigItemForKey(final String key, final Boolean value, final String moduleName, final Promise promise) {
        boolean result = EOCore.updateConfig(key, value.toString(), EOCore.getLifecycleObject(moduleName));
        updateResult(result, promise);
    }

    /**
     * Gets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key as a BOOL value.
     *
     * @param key        Key value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void getBooleanConfigItemForKey(final String key, final String moduleName, final Promise promise) {
        boolean result = EOCore.getConfigItemBoolean(key, EOCore.getLifecycleObject(moduleName));
        updateResult(result, promise);
    }

    /**
     * Sets the module's string configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      String Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void setStringItemForKey(final String key, final String value, final String moduleName, final Promise promise) {
        boolean result = EOCore.updateConfig(key, value.toString(), EOCore.getLifecycleObject(moduleName));
        updateResult(result, promise);
    }

    /**
     * Gets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param theDefault In case no value if found, use this value as default.
     * @param key        Key.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void getStringItemForKey(final String theDefault, final String key, final String moduleName, final Promise promise) {
        String result = EOCore.getConfigItemString(key, EOCore.getLifecycleObject(moduleName));
        if (TextUtils.isEmpty(result)) {
            result = theDefault;
        }
        updateResult(result, promise);
    }

    /**
     * Sets the module's number configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      Number Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void setNumberItemForKey(final String key, final Double value, final String moduleName, final Promise promise) {
        boolean result = EOCore.updateConfig(key, value.toString(), EOCore.getLifecycleObject(moduleName));
        updateResult(result, promise);
    }

    /**
     * Gets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param theDefault In case no value if found, use this value as default.
     * @param key        Map Key.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void getNumberItemForKey(final int theDefault, final String key, final String moduleName, final Promise promise) {
        Double result = EOCore.getConfigItemDouble(key, EOCore.getLifecycleObject(moduleName));
        updateResult(result, promise);
    }

    /**
     * Sets the module's configuration item from AdvancedConfig.json or BasicConfig.properties that matches the specified key.
     *
     * @param key        Map Key.
     * @param value      Map Value.
     * @param moduleName The class name of the module's EOLifecycleObject for which the configuration item is referencing.
     * @param promise    Javascript Promise interface.
     */
    @ReactMethod
    public void setConfigItem(final String key, final Object value, final String moduleName, final Promise promise) {
        final boolean result = EOCore.updateConfig(key, value.toString(), EOCore.getLifecycleObject(moduleName));
        updateResult(result, promise);
    }

    /**
     * Log Custom event.
     *
     * @param eventName   The name of the event to be logged this will appear in the posted json
     * @param readableMap React-Native compatible map type.
     * @param logLevel    Set a custom log level to the event. This will override the configured log level for that event.
     * @param promise     Javascript Promise interface.
     */
    @ReactMethod
    public void logCustomEvent(final String eventName, final ReadableMap readableMap, final int logLevel, final Promise promise) {
        HashMap<String, String> map = new HashMap<>();

        // Convert to conform with React-Native MAP type
        for (Map.Entry<String, Object> entry : readableMap.toHashMap().entrySet()) {
            map.put(entry.getKey(), entry.getValue().toString());
        }

        final boolean result = Connect.INSTANCE.logCustomEvent(eventName, map, logLevel);
        updateResult(result, promise);
    }

    /**
     * Log exception.
     *
     * @param message   The message of the error/exception to be logged this will appear in the posted json.
     * @param stackInfo The stack trace to be logged with the message.
     * @param unhandled Whether exception is unhandled.
     * @param promise   Javascript Promise interface.
     */
    @ReactMethod
    public void logExceptionEvent(final String message, final String stackInfo, final Boolean unhandled, final Promise promise) {
        final boolean result = Connect.INSTANCE.logExceptionEvent("React Plugin", message, stackInfo, unhandled);
        updateResult(result, promise);
    }

    /**
     * Log Current Screen Layout using native side background thread.
     *
     * @param logicalPageName Page name or title e.g. "Login View Controller"; Must not be empty.
     * @param delay           Number of seconds to wait before logging the view.
     * @param promise         Javascript Promise interface.
     */
    @ReactMethod
    public void logScreenLayout(final String logicalPageName, final int delay, final Promise promise) {
        // Init current page, check before loglayout.
        Connect.INSTANCE.setCurrentLogicalPageName(logicalPageName);
        Connect.INSTANCE.logScreenview(getCurrentActivity(), logicalPageName, ScreenviewType.LOAD);
        if (LayoutUtil.canCaptureUserEvents(null, logicalPageName)) {
            final boolean result = Connect.INSTANCE.logScreenLayout(Objects.requireNonNull(getCurrentActivity()), logicalPageName, delay < 0 ? 300 : delay, true);
            updateResult(result, promise);
        }
        updateResult(true, promise);
    }

    /**
     * Log GeoLocation.  Below permission is need in the AndroidManifest.xml file.
     * <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
     *
     * @param promise Promise used to get result.
     */
    @ReactMethod
    public void logLocation(final Promise promise) {
        final boolean result = Connect.INSTANCE.logGeolocation(EOMonitoringLevel.kEOMonitoringLevelInfo.getValue());
        updateResult(result, promise);
    }

    /**
     * Requests that the framework logs the location information. This is not logged automatically to
     * avoid making unnecessary location updates and to protect the privacy of your application's users
     * by ensuring that location is reported only when the app has some other reason to request it.
     * Your application must include the Core Location framework.
     *
     * @param lat      The geographic latitude of the user.
     * @param lng      The geographic longitude of the user.
     * @param logLevel The monitoring level of the event.
     * @param promise  Javascript Promise interface.
     */
    @ReactMethod
    public void logLocationWithLatitudeLongitude(final double lat, final double lng, final int logLevel, final Promise promise) {
        final boolean result = Connect.INSTANCE.logLocationUpdateEventWithLatitude(lat, lng, logLevel);
        updateResult(result, promise);
    }

    /**
     * Add focus listener to handle EditText UI control.
     *
     * @param textView        Input TextView.
     * @param accessibilityID Accessibility ID(virtual id).
     * @param activity        Current activity.
     */
    public void addFocusAndRegister(final TextView textView, final String accessibilityID, final Activity activity) {
        textView.setOnFocusChangeListener((v, hasFocus) -> {
            if (hasFocus) {
                InputMethodManager imm = (InputMethodManager) v.getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                imm.showSoftInput(v, InputMethodManager.SHOW_FORCED);
                com.tl.uic.util.keyboardview.KeyboardView keyboardView = new com.tl.uic.util.keyboardview.KeyboardView(v.getContext().getApplicationContext(), null);

                if (TextUtils.isEmpty(accessibilityID)) {
                    Connect.INSTANCE.logEvent(keyboardView, Connect.TLF_UI_KEYBOARD_DID_SHOW_NOTIFICATION);
                    Connect.INSTANCE.logEvent(v, Connect.TLF_ON_FOCUS_CHANGE_IN);
                } else {
                    Connect.INSTANCE.logEvent(keyboardView, Connect.TLF_UI_KEYBOARD_DID_SHOW_NOTIFICATION, accessibilityID);
                    Connect.INSTANCE.logEvent(v, Connect.TLF_ON_FOCUS_CHANGE_IN, accessibilityID);
                }
            } else {
                Connect.INSTANCE.logEvent(v, Connect.TLF_ON_FOCUS_CHANGE_OUT);
                InputMethodManager imm = (InputMethodManager) v.getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                imm.hideSoftInputFromWindow(v.getWindowToken(), 0);

                com.tl.uic.util.keyboardview.KeyboardView keyboardView = new com.tl.uic.util.keyboardview.KeyboardView(v.getContext().getApplicationContext(), null);

                if (TextUtils.isEmpty(accessibilityID)) {
                    Connect.INSTANCE.logEvent(keyboardView, Connect.TLF_UI_KEYBOARD_DID_HIDE_NOTIFICATION);
                } else {
                    Connect.INSTANCE.logEvent(keyboardView, Connect.TLF_UI_KEYBOARD_DID_HIDE_NOTIFICATION, accessibilityID);
                }
            }
        });

        Connect.INSTANCE.registerFormField(textView, activity);
    }

    /**
     * Requests that the framework logs the click events on any UIControl or View. Click event is a
     * normalized form of touch up inside event.
     *
     * @param targetViewId    A valid native View Id for lookup.
     * @param accessibilityID Accessibility ID(virtual id).
     * @param promise         Javascript Promise interface.
     */
    @ReactMethod
    public void logClickEvent(final int targetViewId, final String accessibilityID, final Promise promise) {
        try {
            final ReactApplicationContext context = getReactApplicationContext();
            // Add UI-block so we can get a valid reference to the map-view
            final UIManagerModule uiManager = context.getNativeModule(UIManagerModule.class);

            Objects.requireNonNull(uiManager).addUIBlock(nvhm -> {
                final View view = nvhm.resolveView(targetViewId);

                if (view == null) {
                    updateResult(null, promise);
                } else {
                    if (view instanceof EditText) {
                        addFocusAndRegister((EditText) view, null, getCurrentActivity());
                    } else {
                        if (!TextUtils.isEmpty(accessibilityID)) {
                            Connect.INSTANCE.logEvent(view, "click", accessibilityID);
                        } else {
                            Connect.INSTANCE.logEvent(view, "click");
                        }
                    }
                    updateResult(true, promise);
                }
            });
        } catch (Exception e) {
            updateResult(e, promise);
        }
    }

    /**
     * Log click events on react native control.
     *
     * @param targetViewId Target id of the control.
     * @param promise      Javascript Promise interface.
     */
    @ReactMethod
    public void logClickEvent(final int targetViewId, final Promise promise) {
        try {
            final ReactApplicationContext context = getReactApplicationContext();
            // Add UI-block so we can get a valid reference to the map-view
            final UIManagerModule uiManager = context.getNativeModule(UIManagerModule.class);

            Objects.requireNonNull(uiManager).addUIBlock(nvhm -> {
                final View view = nvhm.resolveView(targetViewId);

                if (view == null) {
                    updateResult(null, promise);
                } else {
                    if (view instanceof EditText) {
                        addFocusAndRegister((EditText) view, null, getCurrentActivity());
                    } else {
                        Connect.INSTANCE.logEvent(view, "click");
                    }
                    updateResult(true, promise);
                }
            });
        } catch (Exception e) {
            updateResult(e, promise);
        }
    }

    /**
     * Log EditText change event.
     *
     * @param targetViewId    A valid native View Id for lookup.
     * @param accessibilityID Accessibility ID(virtual id).
     * @param text            The input string
     * @param promise         Javascript Promise interface.
     */
    @ReactMethod
    public void logTextChangeEvent(final int targetViewId, final String accessibilityID, final String text, final Promise promise) {
        try {
            final ReactApplicationContext context = getReactApplicationContext();
            // Add UI-block so we can get a valid reference to the map-view
            final UIManagerModule uiManager = context.getNativeModule(UIManagerModule.class);

            Objects.requireNonNull(uiManager).addUIBlock(nvhm -> {
                final View view = nvhm.resolveView(targetViewId);

                if (view == null) {
                    updateResult(null, promise);
                } else {
                    if (view instanceof EditText && ((EditText) view).getOnFocusChangeListener() == null) {
                        // First time, logEvent and subsequent calls will be handled in change listener
                        Connect.INSTANCE.logEvent(view, Connect.TLF_ON_FOCUS_CHANGE_IN, accessibilityID);
                        addFocusAndRegister((EditText) view, accessibilityID, getCurrentActivity());
                    }
                    updateResult(true, promise);
                }
            });
        } catch (Exception e) {
            updateResult(e, promise);
        }
    }

    /**
     * Requests that the framework logs an screen load event.
     *
     * @param logicalPageName Page name or title e.g. "Login View Controller"; Must not be empty.
     * @param referrer        Page name or title that loads logicalPageName. Could be empty.
     * @param promise         Javascript Promise interface.
     */
    @ReactMethod
    public void logScreenViewContextLoad(final String logicalPageName, final String referrer, final Promise promise) {
        final boolean result = Connect.INSTANCE.logScreenview(Objects.requireNonNull(getCurrentActivity()), logicalPageName, ScreenviewType.LOAD, referrer);
        updateResult(result, promise);
    }

    /**
     * Requests that the framework logs an screen unload event.
     *
     * @param logicalPageName Page name or title e.g. "Login View Controller"; Must not be empty.
     * @param referrer        Page name or title that loads logicalPageName. Could be empty.
     * @param promise         Javascript Promise interface.
     */
    @ReactMethod
    public void logScreenViewContextUnLoad(final String logicalPageName, final String referrer, final Promise promise) {
        final boolean result = Connect.INSTANCE.logScreenview(Objects.requireNonNull(getCurrentActivity()), logicalPageName, ScreenviewType.UNLOAD, referrer);
        updateResult(result, promise);
    }

    /**
     * Log signal json data.
     *
     * @param signalJSON  React-Native compatible map type.
     * @param logLevel    The monitoring level of the event.
     * @param promise     Javascript Promise interface.
     */
    @ReactMethod
    public void logSignal(final ReadableMap signalJSON, final int logLevel, final Promise promise) {
        HashMap<String, Object> map = new HashMap<>();

        // Convert to conform with React-Native MAP type
        for (Map.Entry<String, Object> entry : signalJSON.toHashMap().entrySet()) {
            map.put(entry.getKey(), entry.getValue().toString());
        }

        final boolean result = Connect.INSTANCE.logSignal(map, logLevel);
        updateResult(result, promise);
    }

    /**
     * Helper function for Promise result
     *
     * @param result  Result from Connect API call.
     * @param promise Javascript Promise interface.
     */
    private void updateResult(Object result, Promise promise) {
        if ((result != null) && ((Boolean) result)) {
            promise.resolve(true);
        } else {
            promise.reject("", "", new Throwable());
        }
    }

    /**
     * Used when host resumes.
     */
    @Override
    public void onHostResume() {
        // Initialize Connect library, and hook into activity lifecycle events to help detect if app is in background
        if (!Connect.INSTANCE.isEnabled()) {
            if (Connect.INSTANCE.getApplication() == null) {
                Connect.INSTANCE.init((Application) this.reactContext.getApplicationContext());
            }
            Connect.INSTANCE.enable();
        }
        Connect.INSTANCE.onResume(getCurrentActivity(), null);
    }

    /**
     * Used when host gets paused.
     */
    @Override
    public void onHostPause() {
        Connect.INSTANCE.onPause(getCurrentActivity(), null);
    }

    /**
     * Used when host gets destroyed.
     */
    @Override
    public void onHostDestroy() {
        // TODO fix
        Tealeaf.onDestroy(getCurrentActivity(), null);
//        Connect.INSTANCE.onDestroy(getCurrentActivity(), null);
    }
}