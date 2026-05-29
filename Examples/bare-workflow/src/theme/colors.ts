/**
 * Brand colors — mirror the iOS sample app's Asset Catalog 1:1 so the two
 * demos look identical side-by-side. See `Acoustic-Connect-Mobile-Push-Sample-App/
 * ConnectPushSampleApp/Resources/Assets.xcassets/*.colorset/Contents.json`.
 */
export const Colors = {
  violet: '#1F1E5D',
  periwinkle: '#706CFF',
  acousticGreen: '#00DF8F',
  lime: '#C8FF49',
  background: '#FEFFEF',
  lightGrey: '#EFEFEF',
  middleGrey: '#D0D1D8',
  darkGrey: '#5A5D77',
  white: '#FFFFFF',
} as const

export type ColorName = keyof typeof Colors
