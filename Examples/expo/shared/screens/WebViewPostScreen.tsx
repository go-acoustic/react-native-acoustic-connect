import React, { useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import AcousticConnectRN from 'react-native-acoustic-connect-beta'
import { DemoCard } from '../components/DemoCard'
import { TicketCard } from '../components/TicketCard'
import { PrimaryButton, SecondaryButton } from '../components/buttons'
import { Colors } from '../theme/colors'
import { TICKETS } from '../verification/tickets'

/**
 * Verifies that the SDK's WebView capture does not turn a form POST into a GET
 * (CA-156499).
 *
 * The mechanism it probes: the capture path reloaded the WebView's current URL
 * to grab the layout, and a reload of a POST result re-issues it as a GET. The
 * customer saw that as HTTP 405 on payment submission. The endpoint here only
 * answers POST, so the failure is unambiguous — a GET comes back 405, which is
 * the customer's exact symptom rather than an approximation of it.
 *
 * The form is inline HTML, so the only network dependency is the echo endpoint
 * itself. Point `ECHO_URL` somewhere else if this environment has no route to
 * the public internet.
 */

/**
 * `react-native-webview@14.0.1` types the component as
 * `class WebView<P = undefined> extends Component<WebViewProps & P>`, and
 * `WebViewProps & undefined` collapses to `never` — so the default
 * instantiation rejects every prop. Passing `unknown` for `P` restores
 * `WebViewProps` (it is the identity for `&`) without casting or reaching into
 * the package's internals. An empty-record type would work for the props but
 * adds an index signature that then rejects `ref`.
 */
type Web = WebView<unknown>

/** Minimal shapes for the handlers we use, so we don't depend on types the
 *  package root does not re-export. */
type UrlEvent = { nativeEvent: { url: string } }
type HttpErrorEvent = { nativeEvent: { url: string; statusCode: number } }
type LoadErrorEvent = { nativeEvent: { description: string } }

const ECHO_URL = 'https://httpbin.org/post'

const FORM_HTML = `<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 15px -apple-system, Roboto, sans-serif; margin: 16px; color: #1F1E5D; }
  input, button { font-size: 16px; padding: 10px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
  button { background: #706CFF; color: #fff; border: 0; border-radius: 8px; font-weight: 700; }
  .note { color: #5A5D77; font-size: 13px; }
</style>
<h3>Payment form</h3>
<p class="note">Submits a POST. The endpoint rejects GET with 405, so a
replayed-as-GET reload is unmistakable.</p>
<form method="POST" action="${ECHO_URL}">
  <input name="card" value="4111111111111111">
  <input name="amount" value="42.00">
  <button type="submit">Submit payment</button>
</form>`

export function WebViewPostScreen() {
  const webRef = useRef<Web>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TicketCard ticket={TICKETS['CA-156499']}>
        <View style={styles.statusBox}>
          <Text style={styles.mono}>{status ?? 'submit the form below'}</Text>
          <Text style={styles.mono}>navigations: {reloads}</Text>
        </View>
        {/* The WebView's DOM is not exposed to the accessibility tree, so a
            coordinate tap on the HTML button is unreliable and unautomatable.
            Submitting through injected JS is deterministic and lets a test
            driver trigger the POST the same way a human would. */}
        <PrimaryButton
          testID="btn_webview_submit"
          title="Submit payment (POST)"
          onPress={() => {
            setStatus('submitting…')
            webRef.current?.injectJavaScript(
              'document.forms[0].submit(); true;'
            )
          }}
        />
        {/* The reload that replayed the POST as a GET only runs when a layout
            capture fires while the POST result document is on screen. Nothing
            triggers one by itself here: the configured trigger is screen
            change, and submitting the form does not change screens. Without
            this button the check passes on a broken build too — it did, which
            is why the button exists. */}
        <SecondaryButton
          testID="btn_webview_capture"
          title="Capture layout now (triggers the reload)"
          onPress={() => {
            setStatus('capturing layout…')
            AcousticConnectRN.logScreenLayout('WebViewPost', 0)
          }}
        />
        <SecondaryButton
          testID="btn_webview_reset"
          title="Reload form"
          onPress={() => {
            setStatus(null)
            setReloads(0)
            webRef.current?.reload()
          }}
        />
      </TicketCard>

      <DemoCard title="WebView">
        <View style={styles.webWrap}>
          <WebView<unknown>
            ref={webRef}
            testID="webview_post"
            source={{ html: FORM_HTML, baseUrl: 'https://httpbin.org' }}
            originWhitelist={['*']}
            // Every committed navigation is reported here, so a capture-driven
            // reload shows up as an extra entry with the method it used.
            onNavigationStateChange={(nav: WebViewNavigation) => {
              if (!nav.loading) {
                setReloads((n) => n + 1)
              }
            }}
            onHttpError={({ nativeEvent }: HttpErrorEvent) =>
              setStatus(
                `HTTP ${nativeEvent.statusCode} on ${nativeEvent.url}` +
                  (nativeEvent.statusCode === 405
                    ? ' — POST was replayed as GET'
                    : '')
              )
            }
            onError={({ nativeEvent }: LoadErrorEvent) =>
              setStatus(`error: ${nativeEvent.description}`)
            }
            onLoadEnd={({ nativeEvent }: UrlEvent) => {
              if (nativeEvent.url.includes('/post')) {
                setStatus(
                  `loaded ${nativeEvent.url} — read "method" in the echo`
                )
              }
            }}
            style={styles.web}
          />
        </View>
      </DemoCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingVertical: 20, gap: 20 },
  statusBox: {
    backgroundColor: Colors.lightGrey,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  mono: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.violet,
    fontFamily: 'Courier',
  },
  webWrap: { height: 420, borderRadius: 8, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: Colors.white },
})
