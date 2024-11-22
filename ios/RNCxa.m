//
// Copyright (C) 2024 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
// industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
// Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
// prohibited.

//

#import "RNCxa.h"
#import <React/RCTLog.h>
#import <React/RCTConvert.h>
#import <React/UIView+React.h>
#import <React/RCTUtils.h>
#import <React/RCTScrollView.h>
#import <React/RCTUIManager.h>
#if __has_include(<React/RCTUIManagerUtils.h>)
    #import <React/RCTUIManagerUtils.h>
#endif
#import <React/RCTBridge.h>
#import <EOCore/EOCore.h>
#import <EOCore/EOApplicationHelper.h>
#import <ConnectReactNative/ConnectBridgingHeader.h>
#import <TealeafReactNative/TLFPublicDefinitions.h>
#import <ConnectReactNative/ConnectApplicationHelper.h>
#import <ConnectReactNative/ConnectCustomEvent.h>
#import <CoreLocation/CoreLocation.h>
#import <Foundation/Foundation.h>

@implementation RNConnectDynamicLoad
+ (void)load {
    [self loadConnectConfig];
    [[EOApplicationHelper sharedInstance] setConfigItem:kConfigurableItemSetGestureDetector value:@"false" forModuleName:kTLFCoreModule];
    [[EOApplicationHelper sharedInstance] setConfigItem:kConfigurableItemLogViewLayoutOnScreenTransition value:@"false" forModuleName:kTLFCoreModule];
    [[ConnectApplicationHelper sharedInstance] enableFramework];
    [[ConnectApplicationHelper sharedInstance] isReactNative:YES];
}

+ (void)loadConnectConfig {
    NSArray *eocoreKeys = @[@"CachingLevel", @"DoPostAppComesFromBackground", @"DoPostAppGoesToBackground", @"DoPostAppGoesToClose", @"DoPostAppIsLaunched", @"DoPostOnIntervals", @"DynamicConfigurationEnabled", @"HasToPersistLocalCache", @"LoggingLevel", @"ManualPostEnabled", @"PostMessageLevelCellular", @"PostMessageLevelWiFi", @"PostMessageTimeIntervals", @"CachedFileMaxBytesSize", @"CompressPostMessage", @"DefaultOrientation", @"LibraryVersion", @"MaxNumberOfFilesToCache", @"MessageVersion", @"PostMessageMaxBytesSize", @"PostMessageTimeout",@"TurnOffCorrectOrientationUpdates"];
    NSArray *tealeafKeys = @[@"AppKey", @"DisableAutoInstrumentation", @"GetImageDataOnScreenLayout", @"JavaScriptInjectionDelay", @"KillSwitchEnabled", @"KillSwitchMaxNumberOfTries",@"KillSwitchTimeInterval", @"KillSwitchTimeout", @"KillSwitchUrl", @"UseWhiteList", @"WhiteListParam", @"LogLocationEnabled", @"MaxStringsLength", @"PercentOfScreenshotsSize", @"PercentToCompressImage", @"ScreenShotPixelDensity", @"PostMessageUrl", @"DoPostOnScreenChange", @"printScreen", @"ScreenshotFormat", @"SessionTimeout", @"SessionizationCookieName", @"CookieSecure", @"disableTLTDID",@"SetGestureDetector", @"AddGestureRecognizerUIButton", @"AddGestureRecognizerUIDatePicker", @"AddGestureRecognizerUIPageControl", @"AddGestureRecognizerUIPickerView", @"AddGestureRecognizerUIScrollView", @"AddGestureRecognizerUISegmentedControl", @"AddGestureRecognizerUISwitch", @"AddGestureRecognizerUITextView", @"AddGestureRecognizerWKWebView", @"AddMessageTypeHeader", @"DisableAlertAutoCapture", @"DisableAlertBackgroundForDisabledLogViewLayout", @"DisableKeyboardCapture", @"EnableWebViewInjectionForDisabledAutoCapture", @"FilterMessageTypes", @"InitialZIndex", @"IpPlaceholder", @"LibraryVersion", @"LogFullRequestResponsePayloads", @"LogViewLayoutOnScreenTransition", @"MessageTypeHeader", @"MessageTypes", @"RemoveIp", @"RemoveSwiftUIDuplicates", @"SubViewArrayZIndexIncrementTrigger", @"SwiftUICaptureNonVariadic", @"TextFieldBeingEditedUseSender", @"TreatJsonDictionariesAsString", @"UICPayload", @"UIKeyboardCaptureTouches", @"UseJPGForReplayImagesExtension", @"UseXpathId", @"actionSheet:buttonIndex", @"actionSheet:show", @"alertView:buttonIndex", @"alertView:show", @"autolog:pageControl", @"autolog:textBox:_searchFieldEndEditing", @"button:click", @"button:load", @"canvas:click", @"connection", @"customEvent", @"datePicker:dateChange", @"exception", @"gestures", @"label:load", @"label:textChange", @"layout", @"location", @"mobileState", @"orientation", @"pageControl:valueChanged", @"pickerView:valueChanged", @"screenChangeLevel", @"scroller:scrollChange", @"selectList:UITableViewSelectionDidChangeNotification", @"selectList:load", @"selectList:valueChange", @"slider:valueChange", @"stepper:valueChange", @"textBox:_searchFieldBeginChanged", @"textBox:_searchFieldBeginEditing", @"textBox:_searchFieldEditingChanged", @"textBox:textChange", @"textBox:textChanged", @"textBox:textFieldDidChange", @"toggleButton:click"];
    
    NSBundle *bundle = [NSBundle bundleForClass:self.classForCoder];
    NSURL *bundleURL = [[bundle resourceURL] URLByAppendingPathComponent:@"RNCxaConfig.bundle"];
    NSBundle *resourceBundle = [NSBundle bundleWithURL:bundleURL];
    NSString *path = [resourceBundle pathForResource:@"RNCxaConfig" ofType:@"json"];
    NSData *data = [NSData dataWithContentsOfFile:path];
    NSDictionary *jsonData = [NSJSONSerialization JSONObjectWithData:data options:kNilOptions error:nil];
    
    if (jsonData != nil) {
        NSDictionary *connectData = [jsonData objectForKey:@"Connect"];
        for (NSString* key in connectData) {
            id value = connectData[key];
            
            if ([tealeafKeys containsObject:key]) {
                [[EOApplicationHelper sharedInstance] setConfigItem:key value:value forModuleName:kTLFCoreModule];
            } else if ([eocoreKeys containsObject:key]) {
                [[EOApplicationHelper sharedInstance] setConfigItem:key value:value forModuleName:kEOCoreModule];
            } else if ([key isEqualToString:@"layoutConfig"]) {
                [[EOApplicationHelper sharedInstance] setConfigItem:@"AutoLayout" value:[(NSDictionary*)value objectForKey:@"AutoLayout"] forModuleName:kTLFCoreModule];
                [[EOApplicationHelper sharedInstance] setConfigItem:@"AppendMapIds" value:[(NSDictionary*)value objectForKey:@"AppendMapIds"] forModuleName:kTLFCoreModule];
            }
        }
    }
    
}
@end

@implementation RNCxa
// To export a module named RNCxa
RCT_EXPORT_MODULE()

-(id)init {
    if ( self = [super init] ) {
        // init variables
        _countViews = [NSNumber numberWithInt:1];
        _noViews = [NSNumber numberWithInt:0];
        _start = [NSDate date];
        _end = _start;
        _currentPageName = @"batchDidComplete";
        _work = dispatch_block_create(0, ^{
                        NSLog(@"batchDidComplete");
                });
    }
    return self;
}


@synthesize bridge = _bridge;

- (dispatch_queue_t)methodQueue {
    return RCTGetUIManagerQueue();
    //return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
    // To indicate it needs to use UI thread directly.
    return YES;
//    return NO;
}

- (void)batchDidComplete {
}

/*!
 * @discussion Sets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a BOOL value.
 * @param key - Key to update value in configuration settings.
 * @param value - Value to use.
 * @param moduleName - The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
 * @return Whether it was able to set the value as Boolean value.
 */
RCT_EXPORT_METHOD(setBooleanConfigItemForKey:(NSString *)key value:(id)value forModuleName:(NSString *)moduleName resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    moduleName = [self testModuleName:moduleName];
    id result =  [NSNumber numberWithBool:[[EOApplicationHelper sharedInstance] setConfigItem:key value:value forModuleName:moduleName]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 * @discussion Sets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NString value.
 * @param key - Key to update value in configuration settings.
 * @param value - Value to use.
 * @param moduleName - The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
 * @return Whether it was able to set the value as Boolean value.
 */
RCT_EXPORT_METHOD(setStringItemForKey:(NSString *)key value:(id)value forModuleName:(NSString *)moduleName resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    moduleName = [self testModuleName:moduleName];
    id result = [NSNumber numberWithBool:[[EOApplicationHelper sharedInstance] setConfigItem:key value:value forModuleName:moduleName]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 * @discussion Sets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NSNumber value.
 * @param key - Key to update value in configuration settings.
 * @param value - Value to use.
 * @param moduleName - The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
 * @return Whether it was able to set the value as Boolean value.
 */
RCT_EXPORT_METHOD(setNumberItemForKey:(NSString *)key value:(id)value forModuleName:(NSString *)moduleName resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    moduleName = [self testModuleName:moduleName];
    id result = [NSNumber numberWithBool:[[EOApplicationHelper sharedInstance] setConfigItem:key value:value forModuleName:moduleName]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 * @discussion Gets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a BOOL value.
 * @param key - Key to update value in configuration settings.
 * @param moduleName - The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
 * @return The value of the configuration item key as a BOOL value.
 */
RCT_EXPORT_METHOD(getBooleanConfigItemForKey:(NSString *)key forModuleName:(NSString *)moduleName resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    moduleName = [self testModuleName:moduleName];
    id result = [NSNumber numberWithBool:[[EOApplicationHelper sharedInstance] getBOOLconfigItemForKey:key withDefault:NO forModuleName:moduleName]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 * @discussion Gets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NString value.
 * @param key - Key to update value in configuration settings.
 * @param moduleName - The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
 * @return The value of the configuration item key as a NString value.
 */
RCT_EXPORT_METHOD(getStringItemForKey:(NSString *)key forModuleName:(NSString *)moduleName resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    moduleName = [self testModuleName:moduleName];
    id result = [[EOApplicationHelper sharedInstance] getStringItemForKey:key withDefault:nil forModuleName:moduleName];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 * @discussion Gets the module's configuration item from AdvancedConfig.json or BasicConfig.plist that matches the specified key as a NSNumber value.
 * @param key - Key to update value in configuration settings.
 * @param moduleName - The name of the module to be updated. For EOCore settings, please use 'EOCore' which can be found the following files EOCoreBasicConfig.plist, EOCoreBasicConfig.properties or EOCoreAdvancedConfig.json and 'Connect' for Connect which can be found the following files ConnectBasicConfig.plist, ConnectBasicConfig.properties or ConnectAdvancedConfig.json.
 * @return The value of the configuration item key as a NSNumber value.
 */
RCT_EXPORT_METHOD(getNumberItemForKey:(NSString *)key forModuleName:(NSString *)moduleName resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    moduleName = [self testModuleName:moduleName];
    id result = [[EOApplicationHelper sharedInstance] getNumberItemForKey:key withDefault:nil forModuleName:moduleName];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 @discussion Log custom event.
 @param eventName - the name of the event to be logged this will appear in the posted json.
 @param values - additional key value pairs to be logged with the message.
 @param level - set a custom log level to the event.
 @return Boolean value will return whether it was able to log the custom event.
 */
RCT_EXPORT_METHOD(logCustomEvent:(NSString *)eventName values:(NSDictionary *)values level:(nonnull NSNumber*)level resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logEvent:eventName values:values level:[self getLogLevel:level]]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 @discussion Log signal data.
 @param values - additional key value pairs to be logged with the signal message.
 @param level - set a custom log level to the event.
 @return Boolean value will return whether it was able to log the signal message.
 */
RCT_EXPORT_METHOD(logSignal:(NSDictionary *)values level:(nonnull NSNumber*)level resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logSignal:values level:[self getLogLevel:level]]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 @discussion Log exception.
 @param message - the message of the error/exception to be logged this will appear in the posted json.
 @param stackInfo - the stack trace to be logged with the message.
 @param unhandled - Whether exception is unhandled.
 @return Boolean value will return whether it was able to log the exception event.
 */
RCT_EXPORT_METHOD(logExceptionEvent:(NSString *)message stack:(NSString *)stackInfo unhandled:(BOOL)unhandled resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSDictionary *exceptionDict = @{ @"type": @"React Plugin", @"message": message, @"stacktrace": stackInfo};
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logNSExceptionEvent:nil dataDictionary:exceptionDict isUnhandled:unhandled]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

#pragma mark - Location
/*!
 @discussion Requests that the framework logs a geographic location
 @return Boolean value will return whether it was able to log the location event.
 */
RCT_EXPORT_METHOD(logLocation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    CLLocation *location = nil;
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logLocation:location]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 @discussion Requests that the framework logs the location information. This is not logged automatically to avoid making unnecessary location updates and to protect the privacy of your application's users by ensuring that location is reported only when the app has some other reason to request it. Your application must include the Core Location framework.
 @param lat - The geographic latitude of the user.
 @param lng - The geographic longitude of the user.
 @param level - The monitoring level of the event.
 @return Boolean value will return whether it was able to log the location event.
 */
RCT_EXPORT_METHOD(logLocationWithLatitudeLongitude:(double)lat longitude:(double)lng level:(nonnull NSNumber*)level resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logLocationUpdateEventWithLatitude:lat longitude:lng level:[self getLogLevel:level]]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

#pragma mark - UIControls
/**
 @discussion Requests that the framework logs the click events on any UIControl or UIView. Click event is a normalized form of touch up inside event.
 @param target - Native node handle for a component from React Native.
 @param controlId - Control id a component from React Native.
 @return Boolean value will return whether it was able to log the click event.
 */
RCT_EXPORT_METHOD(logClickEvent:(nonnull NSNumber *)target controlId:(NSString *)controlId resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        // Get view
        UIView *view;
        
        if ([target intValue] == -1) {
            // Use main view?
            //            UIWindow *window = [[UIApplication sharedApplication] keyWindow];
            //            view = window.rootViewController.view;
        } else {
            view = viewRegistry[target];
        }
        
        if (!view) {
            reject(RCTErrorUnspecified, [NSString stringWithFormat:@"No view found with reactTag: %@", target], nil);
            return;
        }
        
        id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logClickEvent:view controlId:controlId data:nil]];
        [self updateResult:result resolver:resolve rejecter:reject];
    }];
}

/**
 @discussion Requests that the framework logs the text change events.
 @param target - Native node handle for a component from React Native.
 @param controlId - Control id a component from React Native.
 @param text - The input string from txt control.
 @return Boolean value will return whether it was able to log the text change event.
 */
RCT_EXPORT_METHOD(logTextChangeEvent:(nonnull NSNumber *)target controlId:(NSString *)controlId text:(nonnull NSString *)text resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        // Get view
        UIView *view;
        
        if ([target intValue] == -1) {
            // Use main view?
            //            UIWindow *window = [[UIApplication sharedApplication] keyWindow];
            //            view = window.rootViewController.view;
        } else {
            view = viewRegistry[target];
        }
        
        if (!view) {
            reject(RCTErrorUnspecified, [NSString stringWithFormat:@"No view found with reactTag: %@", target], nil);
            return;
        }
        
        NSDictionary* data;
        if (text != nil) {
            data = @{@"text":text};
        }
        
        id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logTextChangeEvent:view data:data]];
        [self updateResult:result resolver:resolve rejecter:reject];
    }];
}

#pragma mark - Screenview
/*!
 @discussion Requests that the framework save the current  application page name.
 @param logicalPageName - Page name or title e.g. "Login View Controller"; Must not be empty.
 @return Boolean value will return whether it was able to log the screenview event.
 */
RCT_EXPORT_METHOD(setCurrentScreenName:(NSString*)logicalPageName resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        id result = [NSNumber numberWithBool:[[ConnectApplicationHelper sharedInstance] resume:logicalPageName]];
        [self updateResult:result resolver:resolve rejecter:reject];
    });
}

/*!
 @discussion Requests that the framework logs an application context for load.
 @param logicalPageName - Page name or title e.g. "Login View Controller"; Must not be empty.
 @param referrer - Page name or title that loads logicalPageName. Could be empty.
 @return Boolean value will return whether it was able to log the screenview event.
 */
RCT_EXPORT_METHOD(logScreenViewContextLoad:(NSString*)logicalPageName referrer:(NSString*)referrer resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *cllasss = logicalPageName == nil ? @"ReactNative" : [NSString stringWithFormat:@"ReactNative_%@", logicalPageName];
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logScreenViewContext:logicalPageName withClass:cllasss  applicationContext:ConnectScreenViewTypeLoad referrer:referrer]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/*!
 @discussion Requests that the framework logs an application context for unload.
 @param logicalPageName - Page name or title e.g. "Login View Controller"; Must not be empty.
 @param referrer - Page name or title that loads logicalPageName. Could be empty.
 @return Boolean value will return whether it was able to log the screenview event.
 */
RCT_EXPORT_METHOD(logScreenViewContextUnload:(NSString*)logicalPageName referrer:(NSString*)referrer resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *cllasss = logicalPageName == nil ? @"ReactNative" : [NSString stringWithFormat:@"ReactNative_%@", logicalPageName];
    id result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logScreenViewContext:logicalPageName withClass:cllasss applicationContext:ConnectScreenViewTypeUnload referrer:referrer]];
    [self updateResult:result resolver:resolve rejecter:reject];
}

/**
 @discussion Requests that the framework logs the layout of the screen
 @param name - Custom name to associate with the viewcontroller.
 @param delay - number of seconds to wait before logging the view.
 @return Boolean value will return whether it was able to log the screen layout event.
 */
RCT_EXPORT_METHOD(logScreenLayout:(NSString*)name andDelay:(nonnull NSNumber *)delay resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        RCTLogInfo(@"logScreenLayout Name:%@ with Delay:%@", name, delay);
        UIViewController *uv = nil;
        UIViewController *topController = EOApplicationHelper.sharedInstance.getUIWindow.rootViewController;
        while (topController.presentedViewController) {
            topController = topController.presentedViewController;
        }
        if (topController) {
            uv = topController;
        }
        
        id result;
        if (delay.floatValue <= 0) {
            result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logScreenLayoutWithViewController:uv andName:name]];
        } else {
            result = [NSNumber numberWithBool:[[ConnectCustomEvent sharedInstance] logScreenLayoutWithViewController:uv andDelay:0.5 andName:name]];
        }
        
        [self updateResult:result resolver:resolve rejecter:reject];
    });
}

- (NSString*)testModuleName:(NSString*)moduleName {
    if ([moduleName caseInsensitiveCompare:@"Connect"]) {
        return moduleName = @"TLFCoreModule";
    }
    return moduleName;
}

- (void)updateResult:(id)result resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
    if (result) {
        resolve(result);
    } else {
        NSError *error;
        reject(@"", @"", error);
    }
}

- (kConnectMonitoringLevelType)getLogLevel:(nonnull NSNumber*)level {
    kConnectMonitoringLevelType monitorLevel = kConnectMonitoringLevelIgnore;
    if (level.intValue == kConnectMonitoringLevelIgnore) {
        monitorLevel = kConnectMonitoringLevelIgnore;
    } else if (level.intValue == kConnectMonitoringLevelCellularAndWiFi) {
        monitorLevel = kConnectMonitoringLevelCellularAndWiFi;
    } else if (level.intValue >= kConnectMonitoringLevelWiFi) {
        monitorLevel = kConnectMonitoringLevelWiFi;
    }
    return monitorLevel;
}
@end
