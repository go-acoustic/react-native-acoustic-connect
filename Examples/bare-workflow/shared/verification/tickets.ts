/**
 * Registry of the fixes this harness verifies, and — just as important — whether
 * each one is actually verifiable against the SDK build the app is running.
 *
 * A fix reaches the app through one of three channels, and they ship on
 * different cadences:
 *
 * - `rn` — TypeScript, or the Kotlin/Swift bridge in this package. Ships with
 *   the npm release, so it is present as soon as the app resolves that version.
 * - `ios-native` — the Connect iOS pod. Only present once a pod containing the
 *   commit is published, which lags the source fix.
 * - `android-native` — the Connect Android artifact. Same lag.
 *
 * `blockedBy` is set when the fix exists in source but no published native
 * artifact carries it yet. Those cards still render, deliberately: running them
 * captures the *failing* baseline, which is what makes the later re-run
 * meaningful. Reading a blocked card as a pass is the trap this field exists to
 * prevent.
 */

export type Channel = 'rn' | 'ios-native' | 'android-native' | 'build'

export type Platform = 'ios' | 'android' | 'both'

export type Ticket = {
  key: string
  title: string
  /** What the tester does. */
  action: string
  /** What a fixed build produces. */
  expected: string
  channel: Channel
  platform: Platform
  /** Set when no published artifact carries the fix — the card is a baseline, not a test. */
  blockedBy?: string
}

export const TICKETS: Record<string, Ticket> = {
  'CA-151429': {
    key: 'CA-151429',
    title: 'Custom-event values keep their type',
    action: 'Send a custom event carrying a string, a boolean and a number.',
    expected:
      'Values arrive unwrapped — "pro", "true", "2.0" — not the Kotlin data-class form "Second(value=pro)". Android was the broken platform; iOS already unwrapped correctly, so the two should now agree.',
    channel: 'rn',
    platform: 'both',
  },
  'CA-156074-signal': {
    key: 'CA-156074',
    title: 'logSignal accepts nested JSON',
    action: 'Send the nested signal payload (object + array of objects).',
    expected:
      'Nesting survives to the collector on both platforms. A top-level number is still dropped on Android — an SDK limitation, not this fix — which is why the payload keeps its numbers one level down.',
    channel: 'rn',
    platform: 'both',
  },
  'CA-156074-identity': {
    key: 'CA-156074',
    title: 'loggedIn defaults to loginMethod',
    action:
      'Log an identity with both the signal type and the parameters omitted, so the bridge has to supply its own defaults.',
    expected:
      'The signal carries loginMethod: email. Before the fix the loggedIn default was paired with registrationMethod, so every defaulted identity call emitted the wrong attribute.',
    channel: 'rn',
    platform: 'both',
  },
  'CA-156436': {
    key: 'CA-156436',
    title: 'Layout config from ConnectConfig.json is applied',
    action:
      'Type into the masked field below, then read the value in the posted layout message.',
    expected:
      'The value arrives masked. The config block is named layoutConfigIos / layoutConfigAndroid; the bridge used to look for a plain "layoutConfig" key and so applied nothing at all.',
    channel: 'rn',
    platform: 'both',
  },
  'CA-137818': {
    key: 'CA-137818',
    title: 'eocore/tealeaf on the Android compile classpath',
    action:
      'Nothing to tap — this one is proven by the app building and running at all.',
    expected:
      'The Android module compiles against com.ibm.eo / com.tl types. Connect marks them runtime-scope in its POM, so they need compileOnly + testCompileOnly entries to be visible at compile time.',
    channel: 'build',
    platform: 'android',
  },
  'CA-152632': {
    key: 'CA-152632',
    title: 'Session replay captures React Native <Modal>',
    action: 'Open each modal, interact, and close it.',
    expected:
      'The replay carries a populated control tree for the modal, not an empty one. A React Native <Modal> presents outside the navigator hierarchy, which is why it took a separate capture path.',
    channel: 'ios-native',
    platform: 'ios',
  },
  'CA-155041': {
    key: 'CA-155041',
    title: 'Screenview referrer points at the previous screen',
    action:
      'Move between screens in Screen Views and read the referrer on each screenview.',
    expected:
      "referrer is the screen you came from. The iOS bug set it to the screen's own name on every event, which collapses a whole session into one replay step. Android already chained it correctly.",
    channel: 'ios-native',
    platform: 'ios',
    blockedBy:
      'Fixed in iOS source on 2026-08-20, but the newest published pod (AcousticConnectDebug 2.1.18) was tagged 2026-07-29. Running this today records the failing baseline.',
  },
  'CA-156499': {
    key: 'CA-156499',
    title: 'WebView form POST is not replayed as GET',
    action: 'Submit the form in the WebView screen.',
    expected:
      'The echo shows method POST. The capture reload used to re-issue the current URL as a GET, so a payment submission came back 405 Method Not Allowed.',
    channel: 'android-native',
    platform: 'android',
    blockedBy:
      'This harness does not reproduce the 405, and the shipped SDK test explains why: WebView never calls shouldOverrideUrlLoading for a main-frame form POST, so a normal submission cannot trigger the conversion — the fix\'s own test drives the hazard directly instead. What this harness DID establish: setting GoogleWebViewEnabled false suppresses WebView instrumentation completely (Found Webview 11 -> 0, RNCWebView nodes 3 -> 0, with the screen demonstrably visited), which is the customer\'s missing workaround. On connect 11.0.18-beta — which does NOT carry the fix — the POST survives identically, with WebView capture demonstrably engaged (capture JS injected, RNCWebView nodes in the layout) and after an explicit logScreenLayout on the POST result. So a pass here says nothing about the fix. Lead worth chasing: the SDK logs "WebView Id is: null, DCID value is: null" for the RNCWebView, which suggests it never associates an id with the view and may skip the webview capture path — including the reload — entirely.',
  },
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  'rn': 'React Native SDK',
  'ios-native': 'iOS native SDK',
  'android-native': 'Android native SDK',
  'build': 'Build-time',
}
