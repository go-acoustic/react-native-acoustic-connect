/**
 * Screen-name test matrix for the inferred `pageView` signal.
 *
 * Background: the platform derives a `pageView` signal from **every** type-2
 * (screenview) SDK message. That inference was written for web, where the
 * message carries a URL; a native/RN screen view has none, so the inferred
 * signal failed schema validation with
 * `Missing required field: [url] in object: [signalContent]` and every one was
 * discarded to the invalid-signal topic. The server-side rule now falls back to
 * the **screenview name** when no url is present.
 *
 * That makes `screenview.name` the input under test — so this table drives a
 * spread of name shapes and records what each one probes. `name` is the exact
 * string we expect to arrive as `screenview.name` in the type-2 message, and
 * therefore as `signalContent.url` on the inferred signal.
 *
 * Two delivery paths, because they are not interchangeable:
 *
 * - `nav` — pushes a route and sets `params.name`. The SDK's `<Connect>`
 *   navigation listener reads that param (see `extractName` in Connect.tsx)
 *   and forwards it, so this exercises the real integration path a customer
 *   hits. It cannot carry a falsy name: `extractName` returns
 *   `name ? name : route.name`, so '' and null fall back to the route name.
 * - `direct` — calls `logScreenViewContextLoad(name, referrer)`, which emits a
 *   type-2 with the exact string on both platforms. The only way to test the
 *   empty and null names, which is where the fallback is most likely to still
 *   produce an invalid signal.
 */

export type CaseVia = 'nav' | 'direct' | 'both'

export type ScreenViewCase = {
  /** Stable id — also the testID suffix, so automation can address a case. */
  id: string
  /** Button label. */
  label: string
  /**
   * The screen name to log. `null` is deliberate: the Android bridge stringifies
   * a null logical page name (`logicalPageName?.asSecondOrNull().toString()`),
   * so it should arrive as the literal text "null" rather than as absent.
   */
  name: string | null
  /** What this case probes on the server side. */
  probes: string
  via: CaseVia
}

/** Exactly 300 characters, to probe any max-length bound on the url attribute. */
const LONG_NAME = 'Lot 4815 '.repeat(34).slice(0, 300)

/**
 * Plausible drill-down screens for an auction/retail app — the shape the
 * reporting customer's bidder app actually produces. These are the happy path:
 * ordinary names, one with a space, repeated visits as you navigate back and
 * forth.
 */
export const REALISTIC_CASES: ScreenViewCase[] = [
  {
    id: 'catalog',
    label: 'Catalog',
    name: 'Catalog',
    probes:
      'Baseline. A bare word is not a URL — proves the schema accepts a non-URL string in url at all.',
    via: 'nav',
  },
  {
    id: 'product_details',
    label: 'Product Details',
    name: 'Product Details',
    probes:
      'Space in the name. Most common real-world shape; a naive URL normaliser may reject or escape it.',
    via: 'nav',
  },
  {
    id: 'bid_confirmation',
    label: 'Bid Confirmation',
    name: 'Bid Confirmation',
    probes:
      'Second spaced name, so repeat vs distinct url values can be told apart in Signal Management.',
    via: 'nav',
  },
  {
    id: 'checkout',
    label: 'Checkout',
    name: 'Checkout',
    probes:
      'Terminal screen. Visited more than once via back-navigation, to check repeat urls all stay valid.',
    via: 'nav',
  },
]

/**
 * Name shapes that could still defeat the fallback. Ugly on purpose — each one
 * exists to answer a specific question about the server-side rule, and the
 * blank and null cases are the two most likely to still land in the DLQ.
 */
export const EDGE_CASES: ScreenViewCase[] = [
  {
    id: 'reserved_chars',
    label: 'URL-reserved characters',
    name: 'Order #4815 & Refund?ref=a/b',
    probes:
      'Contains ? & # / — if the rule parses the value as a URL, the query/fragment split may truncate or reject it.',
    via: 'both',
  },
  {
    id: 'non_ascii',
    label: 'Non-ASCII + emoji',
    name: 'Płatności ✓ 🛒',
    probes:
      'Multi-byte characters. Probes encoding through the collector, the rule, and the schema validator.',
    via: 'both',
  },
  {
    id: 'long',
    label: '300-character name',
    name: LONG_NAME,
    probes:
      'Any max-length bound on the url attribute. A truncation would show as a clipped url; a bound would show as invalid.',
    via: 'both',
  },
  {
    id: 'url_shaped',
    label: 'Already URL-shaped',
    name: 'https://app.example.com/looks-like-a-url',
    probes:
      'Name that is already a URL — confirms the rule does not prefix or wrap a value that needs no fallback treatment.',
    via: 'both',
  },
  {
    id: 'whitespace',
    label: 'Whitespace only',
    name: '   ',
    probes:
      'Non-empty but semantically blank. Passes a null check, so it may produce a valid-but-useless url.',
    via: 'both',
  },
  {
    id: 'empty',
    label: 'Empty name',
    name: '',
    probes:
      "The highest-risk case. TLTRN maps an undefined route name to '', so a real app can emit this — and an empty url may still fail the required-field check.",
    via: 'direct',
  },
  {
    id: 'null',
    label: 'Null name',
    name: null,
    probes:
      'Android stringifies a null name, so url should read literally "null". iOS drops the message instead — a platform difference worth recording.',
    via: 'direct',
  },
]

export const ALL_CASES: ScreenViewCase[] = [...REALISTIC_CASES, ...EDGE_CASES]

/** Cases reachable by pushing a route with `params.name`. */
export const NAV_CASES = ALL_CASES.filter(
  (c) => c.via === 'nav' || c.via === 'both'
)

/** Cases that must go through `logScreenViewContextLoad` to keep the exact string. */
export const DIRECT_CASES = ALL_CASES.filter(
  (c) => c.via === 'direct' || c.via === 'both'
)
