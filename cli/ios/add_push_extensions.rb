#!/usr/bin/env ruby
# frozen_string_literal: true

# add_push_extensions.rb  (SDK-shipped, parameterized)
#
# Idempotently adds the two Acoustic Connect push extensions to a host app's
# Xcode project:
#
#   * ConnectNSE — Notification Service Extension (rich-media download +
#     PushReceived signal logging via the App Group pending store)
#   * ConnectNCE — Notification Content Extension (rich expansion UI)
#
# Both subclass the Connect SDK base classes and share the host app's App
# Group. This is the MANUAL setup path for bare React Native projects; the Expo
# Config Plugin performs the equivalent target surgery automatically for Expo
# projects.
#
# This is the generalized version that ships inside the SDK package. It is
# normally invoked by `acoustic-connect setup-ios-push` (cli/ios/setup-push.mjs),
# which derives the parameters from the project and creates the per-extension
# source/plist/entitlements files from templates BEFORE running this — this
# script only performs the pbxproj surgery and assumes those files exist.
#
# Parameters come from the environment (the Node wrapper sets them):
#   ACOUSTIC_PROJECT_PATH      absolute path to the .xcodeproj   (required)
#   ACOUSTIC_APP_TARGET        host app target name              (required)
#   ACOUSTIC_APP_BUNDLE_ID     host app bundle identifier        (optional —
#                              falls back to the app target's
#                              PRODUCT_BUNDLE_IDENTIFIER)
#   ACOUSTIC_DEPLOYMENT_TARGET iOS deployment target (default 15.1)
#   ACOUSTIC_SWIFT_VERSION     Swift version        (default 5.0)
#   ACOUSTIC_DEVELOPMENT_TEAM  Apple Team ID (10-char)           (optional —
#                              when set, stamped onto the host + both extension
#                              targets so all three sign consistently. Without a
#                              team a CLI build falls back to ad-hoc signing,
#                              which drops aps-environment → no APNs token.)
#
# Requires the `xcodeproj` gem (ships with CocoaPods).

require 'xcodeproj'

def env!(key)
  value = ENV[key]
  raise "#{key} is required" if value.nil? || value.empty?

  value
end

PROJECT_PATH = env!('ACOUSTIC_PROJECT_PATH')
APP_TARGET_NAME = env!('ACOUSTIC_APP_TARGET')
DEPLOYMENT_TARGET = ENV.fetch('ACOUSTIC_DEPLOYMENT_TARGET', '15.1')
SWIFT_VERSION = ENV.fetch('ACOUSTIC_SWIFT_VERSION', '5.0')
# Optional — only stamped when provided (and non-empty / not the placeholder).
DEVELOPMENT_TEAM = ENV['ACOUSTIC_DEVELOPMENT_TEAM'].to_s.strip
TEAM_SET = !DEVELOPMENT_TEAM.empty? && DEVELOPMENT_TEAM != 'YOUR_TEAM_ID'

EXTENSIONS = [
  {
    name: 'ConnectNSE',
    source: 'NotificationService.swift',
    suffix: 'ConnectNSE',
    # UserNotifications declares the service-extension point
    # (com.apple.usernotifications.service / UNNotificationServiceExtension).
    frameworks: %w[UserNotifications],
  },
  {
    name: 'ConnectNCE',
    source: 'NotificationViewController.swift',
    suffix: 'ConnectNCE',
    # UserNotificationsUI declares the content-extension point
    # (com.apple.usernotifications.content-extension) and provides the
    # UNNotificationContentExtension context class. WITHOUT it the extension
    # traps on first connection — "Unable to find NSExtensionContextClass
    # (_UNNotificationContentExtensionVendorContext) … did you link the
    # framework that declares the extension point?" — and no custom rich UI
    # renders. UIKit + UserNotifications back the view controller. The Xcode
    # template links these automatically; this scaffolder must do the same.
    frameworks: %w[UserNotificationsUI UserNotifications UIKit],
  },
].freeze

project = Xcodeproj::Project.open(PROJECT_PATH)
app_target = project.targets.find { |t| t.name == APP_TARGET_NAME }
raise "App target #{APP_TARGET_NAME} not found in #{PROJECT_PATH}" unless app_target

# Bundle id: explicit override, else read it off the host app target so the
# extension ids (<bundle>.ConnectNSE / .ConnectNCE) match the real app.
def resolve_bundle_id(app_target)
  explicit = ENV['ACOUSTIC_APP_BUNDLE_ID']
  return explicit unless explicit.nil? || explicit.empty?

  app_target.build_configurations
            .map { |c| c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] }
            .compact
            .find { |v| !v.include?('$(') }
end

APP_BUNDLE_ID = resolve_bundle_id(app_target)
raise 'Could not determine the host bundle id; pass ACOUSTIC_APP_BUNDLE_ID' unless APP_BUNDLE_ID

# 1. Wire the host app's entitlements (App Group + aps-environment) onto both
#    build configurations. Safe to re-run. Stamp the signing team too (when
#    provided) so the host doesn't fall back to ad-hoc signing.
app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] =
    "#{APP_TARGET_NAME}/#{APP_TARGET_NAME}.entitlements"
  config.build_settings['DEVELOPMENT_TEAM'] = DEVELOPMENT_TEAM if TEAM_SET
end

# Make the host entitlements file visible in the project navigator.
app_group = project.main_group.find_subpath(APP_TARGET_NAME, true)
ent_rel = "#{APP_TARGET_NAME}/#{APP_TARGET_NAME}.entitlements"
unless app_group.files.any? { |f| f.path == ent_rel }
  app_group.new_reference(ent_rel)
end

# 2. Ensure there is an "Embed Foundation Extensions" copy-files phase on the
#    app target (dstSubfolderSpec = PlugIns).
embed_phase = app_target.copy_files_build_phases.find do |p|
  p.symbol_dst_subfolder_spec == :plug_ins
end
unless embed_phase
  embed_phase = app_target.new_copy_files_build_phase('Embed Foundation Extensions')
  embed_phase.symbol_dst_subfolder_spec = :plug_ins
end

EXTENSIONS.each do |ext|
  if project.targets.any? { |t| t.name == ext[:name] }
    puts "#{ext[:name]}: target already exists — skipping creation."
    next
  end

  puts "#{ext[:name]}: creating app-extension target."
  target = project.new_target(
    :app_extension,
    ext[:name],
    :ios,
    DEPLOYMENT_TARGET,
    nil,
    :swift
  )

  # Group + source file (added to the Compile Sources phase).
  group = project.main_group.find_subpath(ext[:name], true)
  source_ref = group.new_reference("#{ext[:name]}/#{ext[:source]}")
  target.add_file_references([source_ref])
  # Info.plist + entitlements are referenced via build settings only — add as
  # plain references for navigator visibility (not compiled / copied).
  group.new_reference("#{ext[:name]}/Info.plist")
  group.new_reference("#{ext[:name]}/#{ext[:suffix]}.entitlements")

  target.build_configurations.each do |config|
    bs = config.build_settings
    bs['PRODUCT_BUNDLE_IDENTIFIER'] = "#{APP_BUNDLE_ID}.#{ext[:suffix]}"
    bs['PRODUCT_NAME'] = '$(TARGET_NAME)'
    bs['INFOPLIST_FILE'] = "#{ext[:name]}/Info.plist"
    bs['GENERATE_INFOPLIST_FILE'] = 'NO'
    bs['CODE_SIGN_ENTITLEMENTS'] = "#{ext[:name]}/#{ext[:suffix]}.entitlements"
    bs['CODE_SIGN_STYLE'] = 'Automatic'
    bs['IPHONEOS_DEPLOYMENT_TARGET'] = DEPLOYMENT_TARGET
    bs['SWIFT_VERSION'] = SWIFT_VERSION
    bs['SKIP_INSTALL'] = 'YES'
    bs['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
    bs['CLANG_ENABLE_MODULES'] = 'YES'
    bs['MARKETING_VERSION'] = '1.0'
    bs['CURRENT_PROJECT_VERSION'] = '1'
    bs['TARGETED_DEVICE_FAMILY'] = '1,2'
    bs['LD_RUNPATH_SEARCH_PATHS'] = [
      '$(inherited)',
      '@executable_path/Frameworks',
      '@executable_path/../../Frameworks',
    ]
  end

  # App depends on the extension and embeds it in PlugIns.
  app_target.add_dependency(target)
  build_file = embed_phase.add_file_reference(target.product_reference)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "#{ext[:name]}: target created, embedded, and added as app dependency."
end

# 3. Ensure each extension links the system frameworks that declare its
#    extension point. Runs every time (also repairs pre-existing targets that
#    were created before this step was added), and is idempotent — a framework
#    already in the Link Binary phase is left untouched.
EXTENSIONS.each do |ext|
  target = project.targets.find { |t| t.name == ext[:name] }
  next unless target

  linked = target.frameworks_build_phase.files.map(&:display_name)
  Array(ext[:frameworks]).each do |fw|
    if linked.include?("#{fw}.framework")
      puts "#{ext[:name]}: #{fw}.framework already linked."
    else
      target.add_system_framework(fw)
      puts "#{ext[:name]}: linked #{fw}.framework."
    end
  end

  # Stamp the signing team (when provided) on the extension's build configs —
  # runs over new AND pre-existing targets so all three (host + NSE + NCE) sign
  # consistently. Idempotent.
  next unless TEAM_SET

  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = DEVELOPMENT_TEAM
  end
  puts "#{ext[:name]}: DEVELOPMENT_TEAM set to #{DEVELOPMENT_TEAM}."
end

project.save
puts "Saved #{PROJECT_PATH}"
