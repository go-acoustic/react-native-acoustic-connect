require 'json'
package = JSON.parse(File.read('package.json'))
connectConfig = JSON.parse(File.read('../../ConnectConfig.json'))
repository = package["repository"]["url"]
useRelease = connectConfig["Connect"]["useRelease"]
dependencyName = useRelease ? 'AcousticConnectReactNative' : 'AcousticConnectReactNativeDebug'
iOSVersion = connectConfig["Connect"]["iOSVersion"]
dependencyVersion = iOSVersion.to_s.empty? ? "" : ", '#{iOSVersion}'"

puts "*********react-native-acoustic-connect.podspec*********"
puts "connectConfig:"
puts JSON.pretty_generate(connectConfig)
puts "repository:#{repository}"
puts "useRelease:#{useRelease}"
puts "dependencyName:#{dependencyName}"
puts "dependencyVersion:#{dependencyVersion}"
puts "connectDependency:#{dependencyName}#{dependencyVersion}"
puts "***************************************************************"

Pod::Spec.new do |s|
  s.name             = package["name"]
  s.version          = package["version"]
  s.description      = package["description"]
  s.homepage         = package["homepage"]
  s.summary          = package["summary"]
  s.license          = package["license"]
  s.authors          = package["author"]
  s.platforms        = { :ios => "13.0" }
  
  s.source           = { :git => repository, :tag => s.version }
  s.preserve_paths   = 'README.md', 'package.json', '*.js'
  s.source_files     = "ios/**/*.{h,m,json}"
  s.resource_bundle = {
    'RNCxaConfig' => ['ios/RNCxaConfig.json'],
  }
  s.resource = 'ios/RNCxaConfig.json'
  
  s.dependency       'React'
  s.xcconfig         = { 'HEADER_SEARCH_PATHS' => '../../../ios/Pods/** ' }
  s.dependency       "#{dependencyName}#{dependencyVersion}"
  s.script_phase = {
    :name => 'Build Config',
    :script => %("${PODS_TARGET_SRCROOT}/ios/ConnectConfig/Build_Config.rb" "${PODS_ROOT}" "ConnectConfig.json" "${PODS_TARGET_SRCROOT}"), 
    :execution_position => :before_compile,
  }
end