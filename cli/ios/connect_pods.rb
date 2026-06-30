# frozen_string_literal: true

# connect_pods.rb — shared CocoaPods helper for the Acoustic Connect SDK.
#
# Ships in the published package so consumer Podfiles don't have to re-implement
# the Connect SDK pod resolution. Mirrors AcousticConnectRN.podspec so the host
# app target and the push extensions (ConnectNSE / ConnectNCE) all link the SAME
# SDK build:
#   - useRelease => 'AcousticConnect', otherwise 'AcousticConnectDebug'
#   - floor '>= 2.1.12' (the push permission API floor)
#   - optional exact pin via Connect.iOSVersion
#
# Usage from a Podfile (resolve the file the same way the RN template resolves
# react_native_pods.rb):
#
#   require Pod::Executable.execute_command('node', ['-p',
#     'require.resolve("react-native-acoustic-connect/cli/ios/connect_pods.rb", {paths: [process.argv[1]]})',
#     __dir__]).strip
#
#   target 'MyApp' do
#     # ...
#     pod *acoustic_connect_pod(__dir__)
#   end
#   target 'ConnectNSE' do
#     pod *acoustic_connect_pod(__dir__)
#   end
#
# ConnectConfig.json is resolved at <podfile_dir>/../ConnectConfig.json (the
# consumer app root), matching where the podspec and config.gradle read it.

require 'json'

# Returns [pod_name, requirements_array] for `pod *acoustic_connect_pod(__dir__)`.
#
# podfile_dir : the Podfile's own directory (pass `__dir__`). ConnectConfig.json
#               is read from its parent, i.e. the app root.
# config_path : optional explicit path to ConnectConfig.json (overrides the
#               default lookup).
def acoustic_connect_pod(podfile_dir, config_path: nil)
  path = config_path || File.join(podfile_dir, '..', 'ConnectConfig.json')
  connect_config = JSON.parse(File.read(path))['Connect'] || {}
  use_release = connect_config['useRelease']
  ios_version = connect_config['iOSVersion'].to_s
  name = use_release ? 'AcousticConnect' : 'AcousticConnectDebug'
  floor = '>= 2.1.12'
  requirements = ios_version.empty? ? [floor] : [floor, ios_version]
  [name, requirements]
end
