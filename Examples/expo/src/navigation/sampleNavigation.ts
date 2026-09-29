/**
 * The navigation hooks the shared screens (`Examples/shared/screens`) use,
 * as this app provides them. See the bare-workflow counterpart for why the
 * shared screens go through `@sample/navigation` instead of a router package.
 *
 * From Expo SDK 56, expo-router rejects any app-owned import of
 * `@react-navigation/*` ("expo-router is no longer compatible with
 * react-navigation"), so the shared screens can no longer import those hooks
 * directly. expo-router re-exports its own `useNavigation` and `useRoute` with
 * react-navigation's signatures, and this app's routes (`src/app/(tabs)/behaviour`)
 * carry the same names as the bare-workflow navigator — so calls like
 * `navigation.navigate('ShowcaseDetail', { depth })` behave identically, params
 * included. Wired in `metro.config.js` and `tsconfig.json`.
 */
export { useNavigation, useRoute } from 'expo-router'
