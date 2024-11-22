/**********************************************************************************************
* Copyright (C) 2024 Acoustic, L.P. All rights reserved.
*
* NOTICE: This file contains material that is confidential and proprietary to
* Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
* industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
* Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
* prohibited.
**********************************************************************************************/

def modules = [:]
pipeline {
    agent {
        label 'osx'
    }

    environment {
        SONAR_HOME = "/Users/Shared/Developer/sonar-scanner-4.6.0.2311-macosx/bin"
        SONAR_BUILD_WRAPPER = "/Users/Shared/Developer/build-wrapper-macosx-x86/build-wrapper-macosx-x86"
        PATH="${PATH}:${GEM_HOME}/bin"
    }

    options {
        // Throttle jobs based on global config for the given category
        throttleJobProperty(
            categories: ['SDK','AndroidThrottle'],
            throttleEnabled: true,
            throttleOption: 'category'
        )
    }

    stages {
        stage('Setup Build Environment') {
            when { 
                anyOf { branch 'feature/*'; branch 'develop'; branch 'staging'; branch 'main' }
            }
            steps {
                script {
                    echo 'Set up settings..'
                    setupGlobals("${env.GIT_BRANCH}")
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        checkoutRepos()
                        setupEmulator("A_34_RN")
                    }
                }
            }
        }
        // stage('Build iOS - xcode') {
        //     when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
        //     steps {
        //         echo 'Building..'
        //         script{
        //             runIosTests(true, false)
        //         }
        //     }
        // }
        // Issue starting simulator
        stage('Build iOS - yarn ios') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Building..'
                script{
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        echo "run using react native"
                        runCMD("cd ${testAppDir} && yarn")
                        runCMD("cd ${testAppDir} && yarn ios")
                        runCMD("killall node")
                    }
                }
            }
        }
        // stage('Build Android - gradle') {
        //     when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
        //     steps {
        //         echo 'Building..'
        //         // build errors need to review how to build
        //         // script{
        //         //     runAndroidTests(true, false)
        //         // }
        //     }
        // }
        stage('Build Android - react native cmd') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Building..'
                script{
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        checkEmulatorReady()
                        echo "run using react native"
                        runCMD("cd ${testAppDir} && yarn")
                        runCMD("cd ${testAppDir} && yarn android")
                        runCMD("killall node")
                    }
                }
            }
        }
        stage('Test') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Testing..'
            }
        }
        stage('Publish Feature') {
            when { branch 'develop'}
            steps {
                echo 'Publish Slack Feature....'
                script{
                    getSlackReport(false)
                }
            }
        }
        stage('Publish Beta') {
            when { branch 'develop'}
            steps {
                echo 'Publish Beta....'
                script{
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        updateLibraryDependencies(true)
                        publishBeta()
                        getSlackReport(false)
                    }
                }
            }
        }
        stage('Publish Release') {
            when { branch 'main' }
            steps {
                echo 'Publish Release....'
                script{
                    if (genBuild) {
                        updateLibraryDependencies(false)
                        publishRelease()
                        getSlackReport(true)
                    }
                }
            }
        }
    }
    // post {
    //     // always {
    //     //     script{
    //     //         getSlackReport(false)
    //     //     }
    //     // }
    //     // // Clean after build
    //     // success {
    //     //     cleanWs cleanWhenNotBuilt: false, cleanWhenFailure: false, cleanWhenUnstable: false, deleteDirs: true, disableDeferredWipeout: true, patterns: [[pattern: "**/Reports/**", type: 'EXCLUDE']]
    //     // }
    //     // aborted {
    //     //     cleanWs cleanWhenNotBuilt: false, cleanWhenFailure: false, cleanWhenUnstable: false, deleteDirs: true, disableDeferredWipeout: true, patterns: [[pattern: "**/Reports/**", type: 'EXCLUDE']]
    //     // }
    // }
}

import groovy.transform.Field
import groovy.json.JsonOutput
import java.util.Optional
import hudson.tasks.test.AbstractTestResultAction
import hudson.model.Actionable
import hudson.tasks.junit.CaseResult
import hudson.model.Action
import hudson.model.AbstractBuild
import hudson.model.HealthReport
import hudson.model.HealthReportingAction
import hudson.model.Result
import hudson.model.Run
import hudson.plugins.cobertura.*
import hudson.plugins.cobertura.targets.CoverageMetric
import hudson.plugins.cobertura.targets.CoverageTarget
import hudson.plugins.cobertura.targets.CoverageResult
import hudson.util.DescribableList
import hudson.util.Graph
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import groovy.util.slurpersupport.*
import java.text.SimpleDateFormat

// Global variables
@Field def name              = "ReactNativeConnect"

// Slack reporting
@Field def gitAuthor         = ""
@Field def lastCommitMessage = ""
@Field def testSummary       = "No tests found"
@Field def coverageSummary   = "No test coverage found"
@Field def lintSummary       = "Lint report is null"
@Field def total             = 0
@Field def failed            = 0
@Field def skipped           = 0

// Version stuff
@Field def currentVersion
@Field def srcBranch        = ""

// Commit stuff
@Field def commitDesciption = ""

// Directory paths
@Field def tempTestDir = "${name}Build"
@Field def testAppDir  = "Example/nativebase-v3-kitchensink"
@Field def buildDir    = "${tempTestDir}/react-native-acoustic-connect"
@Field def releaseDir  = "${tempTestDir}/react-native-acoustic-connect"
@Field def buildIosDir = "${testAppDir}/ios/derived"

// Build information
@Field def genBuild  = true

// Test platform
@Field def platform       = "iOS Simulator,name=iPhone 14 Plus,OS=16.0"
@Field def platformName   = platform.replaceAll(/\s|,|=|\./, "_")
@Field def platformLatest = "16.0"
@Field def emulatorId     = ""

@Field def globalVariablesSetup  = false

def setupGlobals(sourceBranch) {
    // reportsSetUp()
    // libraryCurrentVersionOnGitHub = getCurrentVersionOnGitHub()
    srcBranch = sourceBranch
    // echo "libraryCurrentVersionOnGitHub:${libraryCurrentVersionOnGitHub}"
    globalVariablesSetup = true
    echo "globalVariablesSetup:${globalVariablesSetup}"
    getTriggerInfo()

    platformLatest = runCMD("xcrun simctl list | grep -w \"\\-\\- iOS\" | tail -1 | sed -r 's/[--]+//g' | sed -r 's/[iOS ]+//g' ")
    platform = "iOS Simulator,name=iPhone 16 Plus,OS=${platformLatest}"

    def fText = ""
    if (sourceBranch == "main") {
    fText = "Release ${name} build"
    } else {
    fText = "Beta ${name} build"
    }
    createBuild(fText)
}

def getTriggerInfo() {
    def causes = currentBuild.rawBuild.getCauses()

    println "******************************************currentBuild.rawBuild.getCauses() info:******************************************"
    println causes.dump()
    println causes

    causes = ''

    BRCause   = currentBuild.rawBuild.getCause(jenkins.branch.BranchEventCause)
    PRCause   = currentBuild.rawBuild.getCause(org.jenkinsci.plugins.github.pullrequest.GitHubPRCause)
    SCMCause  = currentBuild.rawBuild.getCause(hudson.triggers.SCMTrigger$SCMTriggerCause)
    UserCause = currentBuild.rawBuild.getCause(hudson.model.Cause$UserIdCause)

    println "BRCause:"
    if (BRCause != null && BRCause.properties != null) {
        BRCause.properties.each { println "$it.key -> $it.value" }
    }
    println "PRCause:"
    if (PRCause != null && PRCause.properties != null) {
        PRCause.properties.each { println "$it.key -> $it.value" }
    } 
    println "SCMCause:"
    if (SCMCause != null && SCMCause.properties != null) {
        SCMCause.properties.each { println "$it.key -> $it.value" }
    }
    println "UserCause:"
    if (UserCause != null && UserCause.properties != null) {
        UserCause.properties.each { println "$it.key -> $it.value" }
    }
    println "******************************************currentBuild.rawBuild.getCauses() end:******************************************"
}

def createBuild(findText) {
    def resullt = hasTextBasedOnLastCommit(findText)

    if (resullt == 0) {
        genBuild = false
        currentBuild.result = 'ABORTED'
    } else {
        genBuild = true
    }
}

def runIosTests(isJustBuild, runSonarQube) {
    String xcodebuildCMD   = "arch -x86_64 xcrun"
    String workspacePath   = "${testAppDir}/ios/KitchenSinkappnativebase.xcworkspace"
    String sonarWrapperDir = "${testAppDir}/ios/build_wrapper_output_directory"
    
    echo 'Install xcpretty if not installed - gem install xcpretty'
    runCMD("#!/bin/bash;gem install xcpretty")
    podUpdate()

    echo "Clean build dir: ${buildIosDir}"
    cleanMkDir("${buildIosDir}")

    if (runSonarQube) {
        echo "Setup and run for SonarQube"
        xcodebuildCMD = "$SONAR_BUILD_WRAPPER --out-dir $sonarWrapperDir"
        buildIosDir   = "${testAppDir}/ios/sonarbuild/derived"
        cleanMkDir("${buildIosDir}")
    }
    
    if (isJustBuild) {
        echo "the scheme for building is: KitchenSinkappnativebase"
        runCMD("${xcodebuildCMD} xcodebuild -workspace ${workspacePath} -scheme KitchenSinkappnativebase -derivedDataPath ${buildIosDir} -configuration Debug -destination 'platform=${platform}' -UseModernBuildSystem=YES SUPPORTS_MACCATALYST=NO")
    } else {
        // Not enabled for now - no unit tests
        // echo "the scheme for unit testing is: $scheme"
        // runCMD("${xcodebuildCMD} xcodebuild -workspace ${workspacePath} -scheme ${schemeUnitTest} -derivedDataPath ${buildIosDir} -configuration ${configurationUnitTest} -destination 'platform=${platform}' -enableCodeCoverage YES test -UseModernBuildSystem=YES SUPPORTS_MACCATALYST=NO | xcpretty -t -r junit")

        // echo "Copy over unit tests"
        // cleanMkDir("${reportsDir}/junit")

        // runCMD("mv build/reports ${reportsDir}/junit")
        // runCMD("rm -rf build/reports")
        // runCMD("mv ${reportsDir}/junit/reports/junit.xml ${reportsDir}/junit/${platformName}.xml")
        // runCMD("rm -rf ${reportsDir}/junit/reports")

        // slather()
    }
}

def podUpdate() {
    echo "Fix and install cocopods dependancies for workspace"
    runCMD("cd ${testAppDir} && yarn")
    runCMD("cd ${testAppDir}/ios && pod update")
    // runCMD("cd ${testAppDir}/ios && pod install")
}
def killIosSim() {
    echo "Kill iOS Simulator"
    sh script: "sleep 10"
    runCMD("xcrun simctl shutdown \"iPhone 13\"")
}

def runAndroidTests(isJustBuild, runSonarQube) {
    // echo "Clean build dir: ${buildDir}"
    // runCMD("rm -rf ${buildDir}")
    // runCMD("mkdir ${buildDir}")

    // if (runSonarQube) {
    //     echo "Setup and run for SonarQube"
    //     xcodebuildCMD = "$SONAR_BUILD_WRAPPER --out-dir $sonarWrapperDir"
    //     buildDir = "${tempTestDir}/${name}/sonarbuild/derived"
    //     runCMD("rm -rf ${buildDir}")
    //     runCMD("mkdir -p ${buildDir}")
    // }

    echo "Run Gradle"
    String gradleLine = ""
    if (isJustBuild) {
        runCMD("/Users/Shared/Developer/gradle-6.7/bin/gradle -b \"${testAppDir}/android/build.gradle\" --stacktrace --continue --no-daemon --warning-mode all clean build -Dorg.gradle.jvmargs=-Xmx1536m -Duser.country=US -Duser.language=en")
    } else {
        // checkEmulatorReady()

        // // jacoco tests
        // runCMD("gradle -b \"${androidStudioProjectTestAppPath}/build.gradle\" --stacktrace --continue --no-daemon --warning-mode all jacocoTestReport -Dorg.gradle.jvmargs=-Xmx1536m -Duser.country=US -Duser.language=en")
        // reportsJacoco()

        // // checkstyle
        // runCMD("gradle -b \"${androidStudioProjectNamePath}/build.gradle\" --stacktrace --continue --no-daemon --warning-mode all checkstyle -Dorg.gradle.jvmargs=-Xmx1536m -Duser.country=US -Duser.language=en")
        // reportsCheckstyle()
    }
}

def setupEmulator(deviceId) {
    emulatorId = deviceId

    runCMD("adb start-server")
    // launch emulator
    String cmmmd = "${ANDROID_HOME}/emulator/emulator -avd ${deviceId} -engine auto -wipe-data -no-cache -memory 3072 -no-snapshot-save -no-window&sleep 60s"
    runCMD(cmmmd)
}

def shutdownEmulator() {
    sh script: 'adb -s emulator-5554 emu kill'
}

def checkEmulatorReady() {
    sh script: "adb start-server"

    if (!sh(script: "adb devices", returnStdout: true).contains("emulator")) {
        setupEmulator emulatorId
    }

    def counter = 0
    while (!sh(script: "adb shell getprop sys.boot_completed", returnStdout: true).trim().equals("1")) {
      if (counter >= 60) {
        echo "The emulator has not started, exiting"
        return
      }
      sh script: "sleep 5"
      counter += 5
    }

    counter = 0
    while (!sh(script: "sh GroovyUtils/psgrep.sh testapp", returnStdout: true).trim().isEmpty()) {
      if (counter == 0) {
        echo "Waiting for previous tests to finish..."
      }

      sh script: "sleep 5"
      counter += 5
    }

    echo "No tests running, emulator ready"
}

// "Update library build version number and example app package.json"
def getLibVersion() {
    def packageFile = "package.json"

    if (genBuild) {
        packageFile = "${buildDir}/package.json"
    }

    echo "Get version from:${packageFile}"
    // Get file to update and save
    def fileContent = readFile "${packageFile}"
    Map jsonContent = (Map) new JsonSlurper().parseText(fileContent)
    currentVersion = jsonContent.version
    echo "Current version ${currentVersion}"
}

// "Update library build version number and example app package.json"
def updateLibVersion() {
    def packageFile = "${buildDir}/package.json"

    echo "Get version from:${packageFile}"
    // Get file to update and save
    def fileContent = readFile "${packageFile}"
    Map jsonContent = (Map) new JsonSlurper().parseText(fileContent)
    currentVersion = jsonContent.version
    echo "Current version ${currentVersion}"

    def libVersionArray = currentVersion.split("\\.")
    def major = libVersionArray[0] 
    def minor = libVersionArray[1]
    int patch = libVersionArray[2].toInteger()
    patch = patch + 1
    currentVersion = "${major}.${minor}.${patch}"
    echo "Updated to library version ${currentVersion}"

    jsonContent.put("version", currentVersion)
    //convert maps/arrays to json formatted string
    def json = JsonOutput.toJson(jsonContent)
    json = JsonOutput.prettyPrint(json)
    writeFile(file:"${packageFile}", text: json)

    // Updated file
    def updatedFileContent = readFile "${packageFile}"
    echo "Updated file"
    echo "${updatedFileContent}"

    // Update example app package.json
    def examplePackageFile = "${buildDir}/Example/nativebase-v3-kitchensink/package.json"
    def exampleFileContent = readFile "${examplePackageFile}"
    Map exampleJsonContent = (Map) new JsonSlurper().parseText(exampleFileContent)
    exampleJsonContent.dependencies.put("react-native-acoustic-connect", currentVersion)
    def exampleJson = JsonOutput.toJson(exampleJsonContent)
    exampleJson = JsonOutput.prettyPrint(exampleJson)
    writeFile(file:"${examplePackageFile}", text: exampleJson)
    def updatedExamplePackageFile = readFile "${examplePackageFile}"
    echo "Updated file"
    echo "${updatedExamplePackageFile}"
}

def updateLibraryDependencies(isBeta) {
    def androidConnectLatest = getAndroidLatestVersion(isBeta, "connect")
    def androidTealeafLatest = getAndroidLatestVersion(isBeta, "tealeaf")
    def androidEOCoreLatest  = getAndroidLatestVersion(isBeta, "eocore")

    downloadAndroidLatestVersion(isBeta, "connect", androidConnectLatest)
    downloadAndroidLatestVersion(isBeta, "tealeaf", androidTealeafLatest)
    downloadAndroidLatestVersion(isBeta, "eocore",  androidEOCoreLatest)

    runCMD("cd ${buildDir} && unzip tempconnect.zip -d tempconnect")
    runCMD("cd ${buildDir} && unzip temptealeaf.zip -d temptealeaf")
    runCMD("cd ${buildDir} && unzip tempeocore.zip -d tempeocore")

    // update asset files
    runCMD("cd ${buildDir} && cp -fr tempconnect/assets/ConnectAdvancedConfig.json    android/src/main/assets/ConnectAdvancedConfig.json")
    runCMD("cd ${buildDir} && cp -fr temptealeaf/assets/TealeafBasicConfig.properties android/src/main/assets/TealeafBasicConfig.properties")
    runCMD("cd ${buildDir} && cp -fr temptealeaf/assets/TealeafLayoutConfig.json      android/src/main/assets/TealeafLayoutConfig.json")
    runCMD("cd ${buildDir} && cp -fr temptealeaf/assets/TealeafAdvancedConfig.json    android/src/main/assets/TealeafAdvancedConfig.json")
    runCMD("cd ${buildDir} && cp -fr tempeocore/assets/EOCoreBasicConfig.properties   android/src/main/assets/EOCoreBasicConfig.properties")
    runCMD("cd ${buildDir} && cp -fr tempeocore/assets/EOCoreAdvancedConfig.json      android/src/main/assets/EOCoreAdvancedConfig.json")

    // delete temp files
    runCMD("cd ${buildDir} && rm tempconnect.zip")
    runCMD("cd ${buildDir} && rm temptealeaf.zip")
    runCMD("cd ${buildDir} && rm tempeocore.zip")
    runCMD("cd ${buildDir} && rm -rf tempconnect")
    runCMD("cd ${buildDir} && rm -rf temptealeaf")
    runCMD("cd ${buildDir} && rm -rf tempeocore")

    // update library version
    def configPath = "${buildDir}/scripts/ConnectConfig.json"
    def configContent = readFile "${configPath}"
    Map jsonContent = (Map) new JsonSlurper().parseText(configContent)
    jsonContent.Connect.put("AndroidVersion", androidConnectLatest)
    //convert maps/arrays to json formatted string
    def json = JsonOutput.toJson(jsonContent)
    json = JsonOutput.prettyPrint(json)
    writeFile(file:"${configPath}", text: json)
}

def getAndroidLatestVersion(isBeta, libName) {
    def mavenLocation = "staging"
    if (!isBeta) {
        mavenLocation = "releases"
    }
    def mavenUrl = "https://s01.oss.sonatype.org/content/repositories/${mavenLocation}/io/github/go-acoustic/${libName}/maven-metadata.xml"
    return runCMD("curl ${mavenUrl} | grep '<latest>.*</latest>' | cut -d '>' -f2 | cut -d '<' -f1")
}

def downloadAndroidLatestVersion(isBeta, libName, libVersion) {
    def mavenLocation = "staging"
    if (!isBeta) {
        mavenLocation = "releases"
    }

    def mavenUrl = "https://s01.oss.sonatype.org/content/repositories/${mavenLocation}/io/github/go-acoustic/${libName}/${libVersion}/${libName}-${libVersion}.aar"
    // Download files
    runCMD("cd ${buildDir} && curl ${mavenUrl} --output temp${libName}.zip")
}

def runCMD(commnd) {
    echo "${commnd}"
    OUUUTTPT = sh (
        script: "#!/bin/bash -l\n ${commnd}",
        returnStdout: true
    ).trim()
    echo "${OUUUTTPT}"
    return OUUUTTPT
}

def cleanMkDir(cmDir) {
    removeDir(cmDir)
    runCMD("mkdir -p ${cmDir}")
}

def removeDir(cmDir) {
    def exists = fileExists "${cmDir}"
    if (exists) {
        runCMD("rm -rf ${cmDir}")
    }
}

// "Checkout repo and also switch to beta branch"
def checkoutRepos() {
    // Setup temp directory for repos for publishing
    echo "Create test push location: ${tempTestDir}"
    cleanMkDir("${tempTestDir}")
    runCMD("cd ${tempTestDir} && git clone git@github.com:aipoweredmarketer/react-native-acoustic-connect.git -b ${srcBranch}")

    if (!env.GIT_BRANCH.contains('feature')) {
        // Review
    }

    if (env.GIT_BRANCH.contains('main')) {
        runCMD("cd ${tempTestDir} && git clone git@github.com:go-acoustic/react-native-acoustic-connect.git -b main")
    }
}

def gitPush(path, commitMsg, tagMsg, branch, commitMsg2) {
    echo "Git Push for: ${path}"
    runCMD('''cd \"''' + path + '''\" && git add . -A''')
    runCMD('''cd \"''' + path + '''\" && git commit -a -m \"''' + commitMsg + '''\" -m \"''' + commitMsg2 + '''\"''')
    
    // Tag repos
    echo "Tag repos"
    runCMD('''cd \"''' + path + '''\" && git tag -f \"''' + tagMsg + '''\" -m \"''' + commitMsg2 + '''\"''')

    // Pull from git
    echo "Pull from git"
    runCMD('''cd \"''' + path + '''\" && git pull --rebase origin \"''' + branch + '''\"''')

    // Push to git
    echo "Push to git"
    runCMD('''cd \"''' + path + '''\" && git push -f --tags''')
    runCMD('''cd \"''' + path + '''\" && git push -f --set-upstream origin \"''' + branch + '''\"''')
}

// "Update files for beta"
def updateDescription() {
    def commitDesciptionTitle = "Beta ${name} Change Notes:"
    commitDesciption = readFile "latestChanges"
    commitDesciption = "${commitDesciptionTitle} \n" << commitDesciption
    commitDesciption = commitDesciption.replaceAll("\"", "\'")
}

def publishBeta() {
    updateLibVersion()
    
    withCredentials([string(credentialsId: 'NPMJS_TOKEN', variable: 'NPMJS_TOKEN')]) {
        sh 'echo "//registry.npmjs.org/:_authToken=${NPMJS_TOKEN}" >> ~/.npmrc'
        runCMD('''cd \"''' + buildDir + '''\" && npm publish''')
    }

    updateDescription()
    def commitMsg = "Beta ${name} build: ${currentVersion}"
    echo "push with:"
    echo commitMsg
    echo currentVersion
    echo commitDesciption

    // push repos
    gitPush("${buildDir}", commitMsg, currentVersion, srcBranch, commitDesciption)
}

def publishRelease() {
    getLibVersion()

    echo "Clean up directory in public repo"
    runCMD("cd ${releaseDir} && git rm -f -r .")

    echo "Copy over changes from beta to public repo"
    echo "rsync -av --exclude='.git' ${buildDir}/. ${releaseDir}"
    runCMD("rsync -av --exclude='.git' ${buildDir}/. ${releaseDir}")

    runCMD('''cd \"''' + releaseDir + '''\" && git add . -A''')

    sleep 30

    echo "Search and replace text to fix with public name at react-native-acoustic-connect"
    runCMD("cd ${releaseDir} && git grep -l 'https:\\/\\/github.com\\/aipoweredmarketer\\/react-native-acoustic-connect' | xargs sed -i '' -e 's/https:\\/\\/github.com\\/aipoweredmarketer\\/react-native-acoustic-connect/https:\\/\\/github.com\\/go-acoustic\\/react-native-acoustic-connect/g'")
    runCMD("cd ${releaseDir} && git grep -l 'react-native-acoustic-connect' | xargs sed -i '' -e 's/react-native-acoustic-connect/react-native-acoustic-connect/g'")
    runCMD("cd ${releaseDir} && git grep -l 'connect' | xargs sed -i '' -e 's/connect/connect/g'")
    runCMD("cd ${releaseDir} && git grep -l '' | xargs sed -i '' -e 's///g'")
    runCMD("cd ${releaseDir} && git grep -l 'react-native-acoustic-connect.podspec' | xargs sed -i '' -e 's/react-native-acoustic-connect.podspec/react-native-acoustic-connect.podspec/g'")
    runCMD("mv ${releaseDir}/react-native-acoustic-connect.podspec  ${releaseDir}/react-native-acoustic-connect.podspec")

    // Update package-lock.json
    def examplePackageFile = "${releaseDir}/package-lock.json"
    if (fileExists(examplePackageFile)) {
        def exampleFileContent = readFile "${examplePackageFile}"
        Map exampleJsonContent = (Map) new JsonSlurper().parseText(exampleFileContent)
        exampleJsonContent.put("version", currentVersion)
        key = ''
        exampleJsonContent.packages."$key".put("version", currentVersion)
        def exampleJson = JsonOutput.toJson(exampleJsonContent)
        exampleJson = JsonOutput.prettyPrint(exampleJson)
        writeFile(file:"${examplePackageFile}", text: exampleJson)
    }
    
    withCredentials([string(credentialsId: 'NPMJS_TOKEN', variable: 'NPMJS_TOKEN')]) {
        sh 'echo "//registry.npmjs.org/:_authToken=${NPMJS_TOKEN}" >> ~/.npmrc'
        runCMD('''cd \"''' + releaseDir + '''\" && npm publish''')
    }

    updateDescription()
    def commitMsg = "Release ${name} build: ${currentVersion}"
    echo "push with:"
    echo commitMsg
    echo currentVersion
    echo commitDesciption

    // push repos
    gitPush("${releaseDir}", commitMsg, currentVersion, "main", commitDesciption)
    // gitPush("${buildDir}", commitMsg, currentVersion, srcBranch, commitDesciption)
}

def populateSlackMessageGlobalVariables() {
    getLastCommitMessage()
    getGitAuthor()
    getLibVersion()
}

def getGitAuthor() {
    def commit = sh(returnStdout: true, script: 'git rev-parse HEAD')
    gitAuthor = sh(returnStdout: true, script: "git --no-pager show -s --format='%an' ${commit}").trim()
}

def getLastCommitMessage() {
    lastCommitMessage = sh(returnStdout: true, script: 'git log -1 --pretty=%B').trim()
}

def hasTextBasedOnLastCommit(findText) {
    def resullt
    
    script {
        resullt = sh (script:'''git log -1 | grep -c \"''' + findText + '''\"
              ''', returnStatus: true)
    }
    return resullt
}

def getSlackReport(isRelease) {
    populateSlackMessageGlobalVariables()

    def releaseTitle = ""
    if (isRelease) {
        releaseTitle = "********************Release********************\n"
    }

    echo "currentBuild.result:${currentBuild.result}"

    def buildColor  = "good"
    def jobName     = "${env.JOB_NAME}"
    def buildStatus = "Success"

    if (currentBuild.result != null) {
        buildStatus = currentBuild.result
        if (buildStatus == "FAILURE") {
            failed = 9999
        }
    }

    // Strip the branch name out of the job name (ex: "Job Name/branch1" -> "Job Name")
    // echo "job name::;${jobName}"
    jobName = jobName.getAt(0..(jobName.lastIndexOf('/') - 1))

    if (buildStatus == "ABORTED") {
        buildColor = "warning"
    }

    if (failed > 0) {
        buildStatus = "Failed"
        buildColor  = "danger"
        def failedTestsString = "No current tests now"//getFailedTests()
    
        notifySlack([
            [
                title: "${jobName}, build #${env.BUILD_NUMBER}",
                title_link: "${env.BUILD_URL}",
                color: "${buildColor}",
                author_name: "${gitAuthor}",
                text: "${releaseTitle}${buildStatus}",
                fields: [
                    [
                        title: "Repo",
                        value: "${name}",
                        short: true
                    ],
                    [
                        title: "Branch",
                        value: "${env.GIT_BRANCH}",
                        short: true
                    ],
                    [
                        title: "Beta build",
                        value: "https://www.npmjs.com/package/react-native-acoustic-connect",
                        short: false
                    ],
                    [
                        title: "Version",
                        value: "${currentVersion}",
                        short: false
                    ],
                    [
                        title: "Test Results",
                        value: "${testSummary}",
                        short: true
                    ],
                    [
                        title: "Code Coverage Results",
                        value: "${coverageSummary}",
                        short: true
                    ],
                    [
                        title: "Lint Results",
                        value: "${lintSummary}",
                        short: true
                    ],
                    [
                        title: "Last Commit",
                        value: "${lastCommitMessage}",
                        short: false
                    ]
                ]
            ],
            [
                title: "Failed Tests",
                color: "${buildColor}",
                text: "${failedTestsString}",
                "mrkdwn_in": ["text"],
            ]
        ], buildColor)          
    } else {
        notifySlack([
            [
                title: "${jobName}, build #${env.BUILD_NUMBER}",
                title_link: "${env.BUILD_URL}",
                color: "${buildColor}",
                author_name: "${gitAuthor}",
                text: "${releaseTitle}${buildStatus}",
                fields: [
                    [
                        title: "Repo",
                        value: "${name}",
                        short: true
                    ],
                    [
                        title: "Branch",
                        value: "${env.GIT_BRANCH}",
                        short: true
                    ],
                    [
                        title: "Beta build",
                        value: "https://www.npmjs.com/package/react-native-acoustic-connect",
                        short: false
                    ],
                    [
                        title: "Version",
                        value: "${currentVersion}",
                        short: false
                    ],
                    [
                        title: "Test Results",
                        value: "${testSummary}",
                        short: true
                    ],
                    [
                        title: "Code Coverage Results",
                        value: "${coverageSummary}",
                        short: true
                    ],
                    [
                        title: "Lint Results",
                        value: "${lintSummary}",
                        short: true
                    ],
                    [
                        title: "Last Commit",
                        value: "${lastCommitMessage}",
                        short: false
                    ]
                ]
            ]
        ], buildColor)
    }
}

def notifySlack(attachments, buildColor) {    
    slackSend attachments: attachments, color: buildColor, channel: '#sdk-github'
    slackSend attachments: attachments, color: buildColor, channel: '#sdk-ci-react-native-bender'
}

return this


