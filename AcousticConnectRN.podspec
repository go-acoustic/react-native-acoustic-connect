require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Resolve the consumer's ConnectConfig.json from the Podfile's project root.
#
# Using CocoaPods' install root (the directory containing the Podfile) rather
# than a path relative to this podspec makes config resolution correct in every
# layout, so SDK integration is seamless for clients:
#   - Standalone consumer: the pod lives under <app>/node_modules, the install
#     root is <app>/ios, so <install_root>/../ConnectConfig.json resolves to
#     <app>/ConnectConfig.json.
#   - In-repo example apps (this monorepo's Examples/*): the install root is the
#     example's own ios/ dir, so it resolves to that example's ConnectConfig.json
#     instead of escaping above the repo (which a podspec-relative climb did).
# Falls back to the legacy podspec-relative path when the install root isn't
# available (e.g. `pod spec lint`), preserving prior behaviour.
installRoot = (defined?(Pod::Config) && Pod::Config.instance.installation_root) || nil
consumerConfigPath = File.join(installRoot.to_s, '..', 'ConnectConfig.json') if installRoot
connectConfigPath =
  (consumerConfigPath && File.exist?(consumerConfigPath)) ? consumerConfigPath
                                                          : File.join(__dir__, '..', '..', 'ConnectConfig.json')
connectConfig = JSON.parse(File.read(connectConfigPath))
repository = package["repository"]["url"]
useRelease = connectConfig["Connect"]["useRelease"]
dependencyName = useRelease ? 'AcousticConnect' : 'AcousticConnectDebug'
iOSVersion = connectConfig["Connect"]["iOSVersion"]

# Floor required by the RN bridge:
#   - `ConnectSDK.shared.enable(with:)` and `ConnectConfig` landed in 2.0.0;
#     anything older lacks the Swift symbols this file imports.
#   - Bundle-less init via `_connectApplyBundleDefaults` landed in 2.0.5
#     (Release_Connect_Module_2_0_5, 2026-04-13). Without it,
#     consumers who don't bundle `EOCoreSettings.bundle` + `TLFResources.bundle`
#     fail to enable the SDK at all — the bridge ships no bundles and relies
#     on programmatic config, so this fix is load-bearing here.
# Consumers can still pin a specific version via
# `ConnectConfig.json -> Connect.iOSVersion`; CocoaPods composes both
# constraints, so an attempted downgrade fails loudly at `pod install`.
#
# Push: the iOS Connect SDK ships push as part of the same pod (`ConnectPushConfig`
# is in `ConnectSDK.shared.enable(with:)`), so this single floor covers both the
# analytics and push code paths. If a future SDK major splits push into a
# separate pod or moves push features to a higher floor, this is the natural
# place to introduce a conditional floor keyed off
# `ConnectConfig.json -> Connect.PushEnabled` (mirrors the Android conditional
# on `connect-push-fcm` in `android/build.gradle`).
# 2.1.12 floor: `ConnectSDK.shared.push.requestAuthorization()` and
# `getCurrentAuthorization()` land in 2.1.12. The push permission
# bridge methods call them directly, so an older pod would fail to compile.
# 2.1.13 floor: carries a vital fix for automatic push mode (the
# `ConnectDelegateProxy`-swizzled `UNUserNotificationCenter` delegate path
# the bridge relies on in `pushMode: 'automatic'`). 2.1.12 and older mis-wire
# that path, so the floor is raised to guarantee the fix is present.
sdkFloor = '>= 2.1.13'
dependencyRequirements = iOSVersion.to_s.empty? ? [sdkFloor] : [sdkFloor, iOSVersion]

# Normalize Connect.PushEnabled to a STRICT boolean before writing the native
# config bundle. A nil/absent value otherwise serializes as JSON `null`, and the
# iOS SDK then initializes push-off (ConnectSDK.shared.push == nil) — silently
# breaking push on the very first build. Coercing here guarantees
# the bundle never ships `null`; the native lenient parser defends the runtime
# path, but this prevents shipping a non-boolean value in the first place.
#
# This NEVER raises: PushEnabled is the single push gate, so a config that has
# push infrastructure (e.g. an App Group) but PushEnabled false/absent is a
# perfectly valid push-off integration and must install cleanly. We only coerce,
# and warn when the value isn't a canonical boolean so a typo is visible.
connectSection = (connectConfig["Connect"] ||= {})
rawPush = connectSection["PushEnabled"]
pushEnabledBool =
  rawPush == true || (rawPush.is_a?(String) && rawPush.strip.downcase == "true")
if rawPush.nil?
  puts "WARNING: Connect.PushEnabled was absent/null in ConnectConfig.json — treating it as false in ios/AcousticConnectRNConfig.json. Set \"PushEnabled\": true (boolean) to enable iOS push."
elsif rawPush != true && rawPush != false
  puts "WARNING: Connect.PushEnabled was #{rawPush.inspect} (not a JSON boolean) in ConnectConfig.json — coercing to #{pushEnabledBool}. Use a boolean true/false."
end
connectSection["PushEnabled"] = pushEnabledBool

# Write the merged consumer config to the resource-bundle source path AT POD INSTALL TIME.
# This MUST happen before CocoaPods builds the AcousticConnectRNConfig bundle target,
# which it does as a dependency of the parent target — too early for any build-time
# script_phase to influence. Writing here ensures the bundle ships the consumer's
# AppKey / PostMessageUrl / KillSwitchUrl from the very first build, instead of an
# empty placeholder that causes the SDK to fall back to its bundled demo defaults.
# See: ios/AcousticConnectRNConfig.json (placeholder shipped in the npm tarball;
# overwritten here on every `pod install`).
File.open(File.join(__dir__, 'ios', 'AcousticConnectRNConfig.json'), 'w') do |f|
  f.write(JSON.pretty_generate(connectConfig))
end
puts "Merged ConnectConfig.json into ios/AcousticConnectRNConfig.json (install-time)"

puts "*********react-native-acoustic-connect.podspec*********"
puts "connectConfig:"
puts JSON.pretty_generate(connectConfig)
puts "repository:#{repository}"
puts "useRelease:#{useRelease}"
puts "dependencyName:#{dependencyName}"
puts "dependencyRequirements:#{dependencyRequirements.inspect}"
puts "***************************************************************"

Pod::Spec.new do |s|
  s.name         = "AcousticConnectRN"
  # s.name             = package["name"]
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  s.source       = { :git => "https://github.com/ohernandezIBM/react-native-acoustic-connect.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]
  # Unit tests live in ios/Tests and belong to the UnitTests test_spec below,
  # not to the library target (source_files globs ios/**/*.swift).
  s.exclude_files = "ios/Tests/**"

  s.pod_target_xcconfig = {
    # C++ compiler flags, mainly for folly.
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES",
    # @testable import (UnitTests test_spec) needs testability in Debug.
    "ENABLE_TESTABILITY[config=Debug]" => "YES"
  }

  # Native unit tests. Run through a consumer app's Pods project:
  #   Podfile: pod 'AcousticConnectRN', :path => '../..', :testspecs => ['UnitTests']
  #   xcodebuild test -workspace <app>.xcworkspace -scheme AcousticConnectRN \
  #     -destination 'platform=iOS Simulator,name=<booted sim>'
  # The tests use Swift Testing. They do NOT `@testable import` the pod
  # module — see the source_files comment below for why that's impossible.
  s.test_spec 'UnitTests' do |ts|
    # The sources under test are compiled directly into the test bundle
    # instead of `@testable import`ing the pod module: nitrogen's generated
    # Swift compatibility header emits C++ thunks referencing nitro C++ types
    # (margelo::nitro::ArrayBufferHolder) without including their headers, so
    # the AcousticConnectRN clang module cannot be built by any Swift client —
    # including a test target. Compiling the files here is safe: the linker
    # pulls static-archive members lazily, so the parent lib's copies of
    # these objects are never loaded and no duplicate symbols arise.
    ts.source_files = [
      'ios/Tests/**/*.swift',
      'ios/ConnectRNParsing.swift',
      'nitrogen/generated/ios/swift/Variant_Bool_String_Double.swift',
    ]
    # ios/ConnectRNParsing.swift does `import Connect`. CocoaPods test_specs
    # inherit the parent spec's dependencies implicitly, so this line is
    # observably redundant today — declared explicitly anyway so the test
    # bundle's dependency on the Connect SDK doesn't rely on that inheritance
    # behavior remaining unchanged (e.g. a future migration off CocoaPods).
    ts.dependency dependencyName, *dependencyRequirements
  end

  s.resource_bundle = {
    'AcousticConnectRNConfig' => ['ios/AcousticConnectRNConfig.json'],
  }
  s.resource = 'ios/AcousticConnectRNConfig.json'

  load 'nitrogen/generated/ios/AcousticConnectRN+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency dependencyName, *dependencyRequirements
  install_modules_dependencies(s)
end
