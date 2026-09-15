# Selects the Ruby pinned by the repo's root .ruby-version.
#
# SOURCED (not executed) by the Jenkinsfile's runCMD() ahead of every build
# command, so CocoaPods and bundler run on a known Ruby rather than on whatever
# the agent's default happens to be. Two hard constraints:
#
#   * Silent on stdout. runCMD() returns its command's stdout and callers assign
#     it (the `xcrun simctl` device lookup, the published-version read), so a
#     stray "Using .../ruby-3.3.10" line would corrupt the result. The caller
#     redirects this file's output, but keep it quiet anyway.
#   * Never aborts. The caller runs under `sh -e`; a missing toolchain must not
#     kill the build here. verifyRubyVersion() in the Jenkinsfile is what
#     reports a pin that did not take, with a diagnostic dump.
#
# POSIX sh only — Jenkins runs runCMD's script under /bin/sh, not bash (the
# `#!/bin/bash -l` line in runCMD is inert; see the Jenkinsfile comment there).

__acoustic_ruby_is() {
    # 0 when the active ruby is exactly $1.
    case "$(ruby -e 'print RUBY_VERSION' 2>/dev/null)" in
        "$1") return 0 ;;
        *) return 1 ;;
    esac
}

__acoustic_activate_ruby() {
    __acoustic_pin_file="${WORKSPACE:-.}/.ruby-version"
    [ -r "$__acoustic_pin_file" ] || return 0
    __acoustic_want="$(cat "$__acoustic_pin_file" 2>/dev/null | tr -d '[:space:]')"
    [ -n "$__acoustic_want" ] || return 0

    __acoustic_ruby_is "$__acoustic_want" && return 0

    # 1. RVM's own selector. Preferred: it fixes up GEM_HOME/GEM_PATH as well as
    #    PATH. Needs the `rvm` shell function, which only exists once the loader
    #    is sourced — nothing on this agent does that for us.
    if [ -s "$HOME/.rvm/scripts/rvm" ]; then
        # shellcheck disable=SC1091
        . "$HOME/.rvm/scripts/rvm" >/dev/null 2>&1 || true
        rvm use "$__acoustic_want" >/dev/null 2>&1 || true
        __acoustic_ruby_is "$__acoustic_want" && return 0
    fi

    # 2. The same layout RVM produces, applied by hand. Covers shells where the
    #    `rvm` function does not survive being sourced under POSIX sh.
    if [ -x "$HOME/.rvm/rubies/ruby-$__acoustic_want/bin/ruby" ]; then
        GEM_HOME="$HOME/.rvm/gems/ruby-$__acoustic_want"
        GEM_PATH="$GEM_HOME:$HOME/.rvm/gems/ruby-$__acoustic_want@global"
        PATH="$GEM_HOME/bin:$HOME/.rvm/gems/ruby-$__acoustic_want@global/bin:$HOME/.rvm/rubies/ruby-$__acoustic_want/bin:$PATH"
        export GEM_HOME GEM_PATH PATH
        __acoustic_ruby_is "$__acoustic_want" && return 0
    fi

    # 3. rbenv, for an agent provisioned with it instead of RVM.
    if [ -x "$HOME/.rbenv/versions/$__acoustic_want/bin/ruby" ]; then
        RBENV_VERSION="$__acoustic_want"
        PATH="$HOME/.rbenv/versions/$__acoustic_want/bin:$PATH"
        export RBENV_VERSION PATH
        __acoustic_ruby_is "$__acoustic_want" && return 0
    fi

    # Nothing matched. Leave the agent default in place and stay quiet;
    # verifyRubyVersion() reports it.
    return 0
}

__acoustic_activate_ruby
unset __acoustic_pin_file __acoustic_want 2>/dev/null || true
unset -f __acoustic_activate_ruby __acoustic_ruby_is 2>/dev/null || true
