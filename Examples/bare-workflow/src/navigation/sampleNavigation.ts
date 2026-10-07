/**
 * The navigation hooks the shared screens (`Examples/shared/screens`) use,
 * as this app provides them. The shared screens import them from
 * `@sample/navigation` rather than from a router package, because the two
 * samples that render those screens run on different routers:
 *
 *   - this bare-workflow sample: react-navigation
 *   - the Expo sample: expo-router, which from Expo SDK 56 rejects any
 *     app-owned import of `@react-navigation/*`
 *
 * Both expose the same `useNavigation` / `useRoute` API over the same route
 * names, so each app maps the alias to its own router and the screens stay
 * identical. Wired in `metro.config.js` and `tsconfig.json`.
 */
export { useNavigation, useRoute } from '@react-navigation/native'
