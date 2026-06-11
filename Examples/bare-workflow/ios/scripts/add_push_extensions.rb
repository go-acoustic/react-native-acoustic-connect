#!/usr/bin/env ruby
# frozen_string_literal: true

# add_push_extensions.rb
#
# Idempotently adds the two Acoustic Connect push extensions to the
# ConnectBareWorkflowDemo Xcode project:
#
#   * ConnectNSE — Notification Service Extension (rich-media download +
#     PushReceived signal logging via the App Group pending store)
#   * ConnectNCE — Notification Content Extension (rich expansion UI)
#
# Both subclass the Connect SDK base classes and share the host app's App
# Group. This is the MANUAL setup path for the bare-workflow demo; the Expo
# Config Plugin performs the equivalent target surgery automatically for Expo
# projects.
#
# The script is committed so the wiring is reproducible: if the pbxproj is ever
# regenerated (e.g. a fresh RN template scaffold), re-run it instead of clicking
# through Xcode's "New Target" wizard.
#
#   ruby ios/scripts/add_push_extensions.rb
#   pod install   # links the Connect pod into the new targets (see Podfile)
#
# Requires the `xcodeproj` gem (ships with CocoaPods).

require 'xcodeproj'

IOS_DIR = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(IOS_DIR, 'ConnectBareWorkflowDemo.xcodeproj')
APP_TARGET_NAME = 'ConnectBareWorkflowDemo'
APP_BUNDLE_ID = 'co.acoustic.mobile.connect.new.rn.demo.external.ConnectBareWorkflowDemo'
DEPLOYMENT_TARGET = '15.1'
SWIFT_VERSION = '5.0'

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
raise "App target #{APP_TARGET_NAME} not found" unless app_target

# 1. Wire the host app's entitlements (App Group + aps-environment) onto both
#    build configurations. Safe to re-run.
app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] =
    "#{APP_TARGET_NAME}/#{APP_TARGET_NAME}.entitlements"
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

  linked = target.frameworks_build_phase.files.map do |bf|
    bf.display_name
  end
  Array(ext[:frameworks]).each do |fw|
    if linked.include?("#{fw}.framework")
      puts "#{ext[:name]}: #{fw}.framework already linked."
    else
      target.add_system_framework(fw)
      puts "#{ext[:name]}: linked #{fw}.framework."
    end
  end
end

project.save
puts "Saved #{PROJECT_PATH}"
