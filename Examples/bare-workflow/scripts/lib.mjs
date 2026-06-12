// Shared helpers for the bare-workflow bootstrap scripts.
//
// Cross-platform (macOS / Linux / Windows): only node: built-ins, commands run
// through the platform shell. Used by bootstrap.mjs and the per-platform
// modules (bootstrap.ios.mjs / bootstrap.android.mjs).

import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const isWindows = process.platform === 'win32'
const useColor = process.stdout.isTTY && !process.env.NO_COLOR

const paint = (code, s) => (useColor ? `[${code}m${s}[0m` : s)
export const color = {
  bold: (s) => paint('1', s),
  dim: (s) => paint('2', s),
  red: (s) => paint('31', s),
  green: (s) => paint('32', s),
  yellow: (s) => paint('33', s),
  cyan: (s) => paint('36', s),
}

export function section(title) {
  console.log('\n' + color.bold(color.cyan(`▸ ${title}`)))
}

export function info(msg) {
  console.log(`  ${msg}`)
}

// Run a shell command, streaming its output. Returns true on exit code 0.
// `command` is a full command line (shell-interpreted) so callers can write it
// the way they'd type it; iOS-only commands (pod/bundle) never run on Windows.
export function run(command, {cwd} = {}) {
  const result = spawnSync(command, {cwd, stdio: 'inherit', shell: true})
  return result.status === 0
}

// Run a command and capture stdout/stderr instead of streaming. Used for quick
// version/state probes — never throws (spawnSync returns on a missing binary
// rather than throwing), and is bounded by `timeout` (default 60s) so an
// unresponsive probe — e.g. `adb shell` against an offline device — can't hang
// the bootstrap. On timeout the child is killed and `ok` is false.
export function capture(command, {cwd, timeout = 60000} = {}) {
  const result = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    timeout,
    killSignal: 'SIGKILL',
  })
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

// Is a binary resolvable on PATH? Uses `where` on Windows, `command -v` elsewhere.
export function commandExists(cmd) {
  const probe = isWindows ? `where ${cmd}` : `command -v ${cmd}`
  return spawnSync(probe, {stdio: 'ignore', shell: true}).status === 0
}

export function fileExists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

export function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

// Copy `src` to `dest` only when `dest` is missing. Returns 'created' | 'exists'
// | 'no-template'. Callers surface the `editMsg` so the developer knows to fill
// the freshly-copied file in.
export function copyIfMissing(src, dest) {
  if (fileExists(dest)) return 'exists'
  if (!fileExists(src)) return 'no-template'
  fs.mkdirSync(path.dirname(dest), {recursive: true})
  fs.copyFileSync(src, dest)
  return 'created'
}

// Walk up from `startDir` for the nearest package.json declaring a `workspaces`
// array — that's where `npm install` must run so the SDK is hoisted/symlinked.
// Returns null for a standalone (published) checkout with no workspace.
//
// Only a workspace that actually declares THIS app as a member counts — we
// verify `target` matches one of the candidate's `workspaces` globs. That way
// an unrelated outer workspace (e.g. a CI tool's own monorepo root that happens
// to sit above the checkout) is skipped rather than mistaken for our root.
export function findWorkspaceRoot(startDir) {
  const target = path.resolve(startDir)
  let dir = target
  for (;;) {
    const pkgPath = path.join(dir, 'package.json')
    if (fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(readText(pkgPath))
        if (pkg && pkg.workspaces && workspaceIncludes(dir, pkg.workspaces, target))
          return dir
      } catch {
        // ignore malformed package.json and keep walking up
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

// Does `rootDir`'s `workspaces` declaration cover `target`? Handles the array
// form and the { packages: [...] } object form, with npm's glob semantics
// (`*` within a path segment, `**` across segments).
function workspaceIncludes(rootDir, workspaces, target) {
  const globs = Array.isArray(workspaces)
    ? workspaces
    : Array.isArray(workspaces.packages)
      ? workspaces.packages
      : []
  if (rootDir === target) return true // the workspace root itself
  const rel = path.relative(rootDir, target).split(path.sep).join('/')
  return globs.some((glob) => {
    const pattern = String(glob).replace(/\/$/, '')
    const re = new RegExp(
      '^' +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials (keep * /)
          .replace(/\*\*?/g, (m) => (m === '**' ? '.*' : '[^/]*')) + // ** -> .* , * -> one path segment
        '$',
    )
    return re.test(rel)
  })
}

// Accumulates pass/warn/fail results and prints a final summary. A single
// `fail` makes the process exit non-zero so CI / the developer notice.
export class Reporter {
  constructor() {
    this.results = []
  }

  record(status, label, detail) {
    this.results.push({status, label, detail})
    const mark =
      status === 'pass'
        ? color.green('✓')
        : status === 'warn'
          ? color.yellow('⚠')
          : color.red('✗')
    const tail = detail ? ` ${color.dim('— ' + detail)}` : ''
    console.log(`  ${mark} ${label}${tail}`)
  }

  pass(label, detail) {
    this.record('pass', label, detail)
  }

  warn(label, detail) {
    this.record('warn', label, detail)
  }

  fail(label, detail) {
    this.record('fail', label, detail)
  }

  hasFailures() {
    return this.results.some((r) => r.status === 'fail')
  }

  // Print the summary and any actionable next steps, then return the exit code.
  summary(nextSteps = []) {
    const counts = {pass: 0, warn: 0, fail: 0}
    for (const r of this.results) counts[r.status]++

    section('Summary')
    info(
      `${color.green(counts.pass + ' ok')}, ` +
        `${color.yellow(counts.warn + ' warning(s)')}, ` +
        `${color.red(counts.fail + ' failure(s)')}`,
    )

    const actionable = this.results.filter(
      (r) => r.status !== 'pass' && r.detail,
    )
    if (actionable.length) {
      section('Action needed')
      for (const r of actionable) {
        const mark = r.status === 'fail' ? color.red('✗') : color.yellow('⚠')
        info(`${mark} ${r.label}: ${r.detail}`)
      }
    }

    if (nextSteps.length) {
      section('Next steps')
      for (const s of nextSteps) info(`• ${s}`)
    }

    return this.hasFailures() ? 1 : 0
  }
}
