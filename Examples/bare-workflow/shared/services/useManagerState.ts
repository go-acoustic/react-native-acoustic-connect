import { useSyncExternalStore } from 'react'
import {
  ConnectSDKManager,
  type ManagerState,
} from './ConnectSDKManager'

/**
 * React hook that subscribes a screen to `ConnectSDKManager` updates.
 * Uses `useSyncExternalStore` so concurrent rendering stays correct.
 */
export function useManagerState(): ManagerState {
  return useSyncExternalStore(
    (listener) => ConnectSDKManager.subscribe(listener),
    () => ConnectSDKManager.getState()
  )
}
