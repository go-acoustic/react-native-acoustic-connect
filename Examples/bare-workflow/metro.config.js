const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const fs = require('fs')
const path = require('path')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * Workspace vs standalone — this matters for `watchFolders`:
 *
 * - In the SDK monorepo this sample is an npm workspace member. The SDK source
 *   lives two levels up and is consumed via the SDK's `react-native:
 *   "src/index"` field, so we add that root to `watchFolders` to hot-reload
 *   live SDK edits.
 * - In a standalone checkout of the published sample there is NO SDK parent —
 *   the SDK is an ordinary `node_modules` dependency. There, `../..` is just the
 *   directory you happened to clone into (e.g. your projects folder), and
 *   adding it to `watchFolders` makes Metro try to watch that whole tree —
 *   which hangs on Watchman. So only add the folder when `../..` is genuinely
 *   the SDK root.
 *
 * `@shared` — the cross-sample UI shared with Examples/expo. In the monorepo it
 * is a sibling directory (`../shared`); in the published/standalone sample the
 * Jenkinsfile vendors it as a subdirectory (`./shared`) so the app stays
 * self-contained. Resolve whichever layout is present.
 *
 * @type {import('metro-config').MetroConfig}
 */
const sdkRoot = path.resolve(__dirname, '..', '..')
const isSdkWorkspaceRoot = (() => {
  try {
    return (
      require(path.join(sdkRoot, 'package.json')).name ===
      'react-native-acoustic-connect-beta'
    )
  } catch {
    return false
  }
})()

const siblingShared = path.resolve(__dirname, '..', 'shared')
const sharedDir = fs.existsSync(siblingShared)
  ? siblingShared
  : path.resolve(__dirname, 'shared')

// Only watch the shared dir if it is actually on disk. In a standalone clone
// the Jenkinsfile vendors `./shared` before building, but a non-existent path
// in `watchFolders` makes Metro throw. The `@shared` alias is left mapped
// regardless so an absent dir surfaces as a clear module-resolution error
// rather than an opaque watcher crash.
const sharedExists = fs.existsSync(sharedDir)

const config = {
  watchFolders: [
    ...(isSdkWorkspaceRoot ? [sdkRoot] : []),
    ...(sharedExists ? [sharedDir] : []),
  ],
  resolver: {
    // `extraNodeModules` can't alias `@shared`: Metro (parseBareSpecifier)
    // treats any specifier starting with `@` as a scoped package and keys the
    // lookup on the first TWO segments — so `@shared/services/Foo` is looked up
    // under `@shared/services`, never `@shared`, and the alias is never hit.
    // Rewrite the `@shared` prefix to the resolved shared dir ourselves so
    // arbitrary subpaths resolve. (An absent sharedDir still surfaces as a
    // clear "Unable to resolve" rather than an opaque watcher crash.)
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@shared' || moduleName.startsWith('@shared/')) {
        const subpath = moduleName.slice('@shared'.length)
        return context.resolveRequest(
          context,
          subpath ? path.join(sharedDir, subpath) : sharedDir,
          platform
        )
      }
      return context.resolveRequest(context, moduleName, platform)
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
