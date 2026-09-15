// Copyright (C) 2025 Acoustic, L.P. All rights reserved.
//
// NOTICE: This file contains material that is confidential and proprietary to
// Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
// industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
// Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
// prohibited.
//
//
//  Created on 5/9/25.
//

package com.acousticconnectrn;

import androidx.annotation.Nullable;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;
import com.margelo.nitro.acousticconnectrn.AcousticConnectRNOnLoad;

import java.util.HashMap;

public class AcousticConnectRNPackage extends TurboReactPackage {
  @Nullable
  @Override
  public NativeModule getModule(@NonNull String name, @NonNull ReactApplicationContext reactContext) {
    return null;
  }

  @NonNull
  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return HashMap::new;
  }

  static {
    // Nitro's C++ factory (AcousticConnectRNOnLoad.cpp) constructs instances
    // of HybridAcousticConnectRN itself via a zero-arg constructor, lazily on
    // first JS call. Earlier versions of this file spun up a background
    // thread to poll NitroModules.getApplicationContext() and eagerly
    // construct one instance — that workaround was masking the symptom of
    // the bridge holding a stored ReactApplicationContext field that Nitro's
    // factory then passed as null. The bridge now resolves the React context
    // on-demand from NitroModules.applicationContext (nullable, guarded), so
    // no eager construction is needed.
    AcousticConnectRNOnLoad.initializeNative();
  }
}
