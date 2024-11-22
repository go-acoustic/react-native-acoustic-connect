//
// Copyright (C) 2024 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
// industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
// Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
// prohibited.

//

#if __has_include(<React/RCTBridgeModule.h>)
    #import <React/RCTBridgeModule.h>
#elif __has_include("RCTBridgeModule.h")
    #import "RCTBridgeModule.h"
#else
    // Required when used as a Pod in a Swift project
    #import "React/RCTBridgeModule.h"
#endif

@interface RNCxa : NSObject <RCTBridgeModule>
@property(nonatomic, strong) NSNumber* countViews;
@property(nonatomic, strong) NSDate *start;
@property(nonatomic, strong) NSDate *end;
@property(nonatomic, strong) NSNumber *noViews;
@property(nonatomic, strong) NSNumber *totalLayoutTime;
@property(nonatomic, strong) NSString *currentPageName;
@property(nonatomic, strong) dispatch_block_t work;

@end
@interface RNConnectDynamicLoad : NSObject
@end
