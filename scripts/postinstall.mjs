// Cross-platform postinstall (replaces the bash-only postInstallScripts.sh,
// which silently no-opped on Windows and violated the repo's cross-platform
// rule). Runs the same three helper scripts that integrate the SDK into a
// consumer project, from the package root, best-effort: a non-zero exit from
// any of them is logged but never fails `npm install`.

import {spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.dirname(scriptsDir)

// Order matches the original postInstallScripts.sh. Note: the file is
// `xmlparser.js` (lowercase) — the old shell script referenced `xmlParser.js`
// with a capital P, which failed on case-sensitive filesystems (Linux CI).
const steps = ['reviewConnectConfig.js', 'xmlparser.js', 'gradleParser.js']

console.log(
  '**Acoustic Integration***********************************************************************',
)
for (const step of steps) {
  console.log(`Running scripts/${step} ...`)
  const result = spawnSync(process.execPath, [path.join('scripts', step)], {
    cwd: packageRoot,
    stdio: 'inherit',
  })
  if (result.status !== 0)
    console.log(
      `scripts/${step} exited with ${result.status ?? result.signal} — continuing (postinstall is best-effort).`,
    )
}
console.log(
  '*********************************************************************************************',
)
