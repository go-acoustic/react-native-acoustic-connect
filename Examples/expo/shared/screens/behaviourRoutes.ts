/**
 * Route map of the Behaviour tab's stack, shared by both sample apps'
 * navigators so the route names the shared screens navigate to are typed in
 * one place.
 *
 * `name` params are read by the SDK's `<Connect>` as the logged screen name;
 * routes that seed one via `initialParams` declare it optional here.
 *
 * `WebViewPost` is optional at runtime: it needs react-native-webview, which
 * the Expo sample does not carry, so `VerificationScreen` checks the
 * navigator's registered route names before offering the button.
 */
export type BehaviourStackParamList = {
  Behaviour: undefined
  Showcase: { name: string } | undefined
  Verification: { name: string } | undefined
  ShowcaseDetail: { name: string; depth: number }
  ScreenViews: { name: string } | undefined
  Case: { name: string; caseId: string }
  WebViewPost: undefined
}
