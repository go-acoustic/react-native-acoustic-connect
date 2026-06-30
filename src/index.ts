/********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
* 
* Created on 5/9/25.
* 
********************************************************************************************/

import { NitroModules } from 'react-native-nitro-modules'
import type { AcousticConnectRN as AcousticConnectRNSpec } from './specs/react-native-acoustic-connect.nitro'
import Connect from './components/Connect'
import KeyboardListener from './utils/KeyboardListener'
import DialogListener from './utils/DialogListener'
import useDialogTracking from './utils/useDialogTracking'
import { withAcousticAutoDialog } from './utils/withAcousticAutoDialog'
import DialogDebugger from './utils/DialogDebugger'
import TLTRN from './TLTRN'

// Instantiating the native HybridObject is the first thing that fails when the
// app's `react-native-nitro-modules` runtime does not match the version this SDK
// was generated against (the generated registration is tightly coupled to the
// Nitro version — see peerDependencies). Without this guard the failure surfaces
// as an opaque `ClassNotFoundException` and an `undefined` module far from the
// cause. Re-throw with an actionable message instead.
let AcousticConnectRN: AcousticConnectRNSpec
try {
  AcousticConnectRN = NitroModules.createHybridObject<AcousticConnectRNSpec>('AcousticConnectRN')
} catch (error) {
  throw new Error(
    '[AcousticConnectRN] Failed to load the native HybridObject. This almost ' +
      'always means a `react-native-nitro-modules` version mismatch: this SDK is ' +
      'built against the exact version declared in its peerDependencies, so your ' +
      'app must resolve that same version (check `npm ls react-native-nitro-modules`). ' +
      `Original error: ${String(error)}`
  )
}

export { Connect, TLTRN, KeyboardListener, DialogListener, useDialogTracking, DialogDebugger, withAcousticAutoDialog }
export default AcousticConnectRN