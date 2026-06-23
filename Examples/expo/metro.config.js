const { getDefaultConfig } = require('expo/metro-config')
const fs = require('fs')
const path = require('path')

/**
 * Metro configuration — mirrors Examples/bare-workflow/metro.config.js.
 *
 * Workspace vs standalone — this matters for `watchFolders`:
 *
 * - In the SDK monorepo this sample consumes the SDK via the `file:../..`
 *   dependency (a symlink in node_modules). Metro refuses to serve files
 *   outside its watched roots, so the SDK root must be added to
 *   `watchFolders` for the symlinked package to resolve at all.
 * - In a standalone checkout of the published sample the SDK is an ordinary
 *   node_modules dependency and `../..` is just the directory you cloned
 *   into — watching that whole tree hangs Watchman. So only add the folder
 *   when `../..` is genuinely the SDK root.
 */
const projectRoot = __dirname
const sdkRoot = path.resolve(projectRoot, '..', '..')
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

const config = getDefaultConfig(projectRoot)

// `@shared` — the cross-sample UI shared with Examples/bare-workflow. In the
// monorepo it is a sibling directory (`../shared`); a standalone/vendored layout
// keeps it as a subdirectory (`./shared`). Resolve whichever is present (mirrors
// bare-workflow). Alias the bare `@shared` specifier to it and watch the folder
// so Metro serves and transforms its source. (`react` / `react-native` / nitro
// imported inside that source are still pinned to THIS app's copies by the
// singleton resolver below.)
const siblingShared = path.resolve(projectRoot, '..', 'shared');
const sharedDir = fs.existsSync(siblingShared)
  ? siblingShared
  : path.resolve(projectRoot, 'shared');
// Only watch the shared dir if it actually exists — a non-existent path in
// `watchFolders` makes Metro throw on startup (mirrors bare-workflow). The
// `@shared` alias is wired regardless so an absent dir surfaces as a clear
// "Unable to resolve" rather than an opaque watcher crash.
const sharedExists = fs.existsSync(sharedDir);
config.watchFolders = [
  ...(config.watchFolders ?? []),
  ...(sharedExists ? [sharedDir] : []),
];

// `extraNodeModules` can't alias `@shared` here: Metro (parseBareSpecifier)
// treats any specifier starting with `@` as a scoped package and keys the
// lookup on the first TWO segments — so `@shared/services/Foo` is looked up
// under `@shared/services`, never `@shared`, and the alias is never hit
// ("Unable to resolve"). Rewrite the `@shared` prefix to the ../shared
// directory ourselves so arbitrary subpaths resolve. The singleton resolver
// below captures this as its default and chains into it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@shared' || moduleName.startsWith('@shared/')) {
    const subpath = moduleName.slice('@shared'.length);
    return context.resolveRequest(
      context,
      subpath ? path.join(sharedDir, subpath) : sharedDir,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (isSdkWorkspaceRoot) {
  // Watch the SDK root so the symlinked package resolves, but exclude the
  // heavy native / generated / sibling-sample trees so Metro does not crawl
  // ios/, android/, nitrogen/generated/, the other Examples, or .git.
  config.watchFolders = [...(config.watchFolders ?? []), sdkRoot]

  const escapedRoot = sdkRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // This app lives at <sdkRoot>/Examples/<appDir>; never block its own tree.
  const appDir = path
    .basename(projectRoot)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const excluded = [
    // Heavy SDK trees that the JS bundle never imports.
    new RegExp(`^${escapedRoot}/ios/.*`),
    new RegExp(`^${escapedRoot}/android/.*`),
    new RegExp(`^${escapedRoot}/nitrogen/.*`),
    new RegExp(`^${escapedRoot}/\\.git/.*`),
    new RegExp(`^${escapedRoot}/example/.*`),
    // Sibling sample apps under Examples/, but NOT this app and NOT the
    // shared/ UI this app consumes via the @shared alias (kept visible so
    // Metro can serve and transform it).
    new RegExp(`^${escapedRoot}/Examples/(?!(?:${appDir}|shared)/)[^/]+/.*`),
  ]
  const existingBlockList = config.resolver.blockList
  config.resolver.blockList = Array.isArray(existingBlockList)
    ? [...existingBlockList, ...excluded]
    : existingBlockList
    ? [existingBlockList, ...excluded]
    : excluded

  // Pin the singleton packages to THIS app's copies. Hierarchical lookup from
  // inside the symlinked SDK source would otherwise resolve react /
  // react-native / nitro from the SDK root's own node_modules — a second
  // React copy fails at runtime with invalid-hook / dual-renderer errors.
  // We re-run Metro's resolver with the SAME bare specifier but an origin
  // anchored at the app root, so the lookup walks the app's node_modules
  // first. (We must pass a bare specifier, not an absolute path — Metro's
  // resolveRequest contract expects a module specifier.)
  // disableHierarchicalLookup is NOT usable here: expo's own transitive deps
  // rely on nested hierarchical resolution.
  const singletons = ['react', 'react-native', 'react-native-nitro-modules']
  const appOrigin = path.join(projectRoot, 'index.js')
  const defaultResolveRequest = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const isSingleton = singletons.some(
      (s) => moduleName === s || moduleName.startsWith(`${s}/`)
    )
    const resolve = defaultResolveRequest ?? context.resolveRequest
    if (isSingleton) {
      return resolve(
        { ...context, originModulePath: appOrigin },
        moduleName,
        platform
      )
    }
    return resolve(context, moduleName, platform)
  }
}

module.exports = config
