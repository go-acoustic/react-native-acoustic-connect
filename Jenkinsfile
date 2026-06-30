/**********************************************************************************************
* Copyright (C) 2025 Acoustic, L.P. All rights reserved.
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
                        // NOTE: the Android emulator is intentionally NOT launched
                        // here. It is started just-in-time by checkEmulatorReady() at
                        // the top of 'Build Android - npm android' and torn down right
                        // after that stage, so the ~7GB headless qemu is alive ONLY
                        // during the Android build — not during the Nitro rebuild or
                        // the iOS stages/gates, where it was a memory confound behind
                        // the intermittent CI hangs (CA-143485).
                        checkoutRepos()
                    }
                }
            }
        }
        stage('Build Nitro Module React Native Plugin - npm rebuild') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Building..'
                script{
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        echo "building nitro module for react native"
                        runCMD("cd ${buildDir} && nvm use 20 && npm install && npm run rebuild")
                    }
                }
            }
        }
        // 'Build iOS - npm ios' stage removed (CA-143485). It ran
        // `react-native run-ios`, which requires a GUI (Aqua) login session to
        // open Simulator.app and a Metro terminal window — it fails on a headless
        // agent (RBSRequestErrorDomain Code=5 / OSLaunchdErrorDomain Code=125
        // "Domain does not support specified action") and asserts NOTHING about
        // the launch (no on-device tests). The iOS compile of the example app is
        // covered by 'Build iOS - xcode' (xcodebuild, generic Simulator
        // destination); the example's iOS Pods are installed by the Nitro stage's
        // `npm run rebuild` (→ rebuildExample → iOSUpdate → pod update) and again
        // by the Android stage's rebuildExample — both before 'Build iOS - xcode',
        // whose podUpdate() only runs `npm install`. End-to-end Community-CLI /
        // pod-install coverage is the bare-workflow + Expo iOS sample gates.
        stage('Build Android - npm android') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Building..'
                script{
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        echo "building android example app for react native"
                        try {
                            // checkEmulatorReady() launches the emulator just-in-time
                            // if it isn't already up. Inside the try so a boot failure
                            // still hits the finally below (not only post{always}).
                            checkEmulatorReady()
                            runCMD("cd ${testAppDir} && nvm use 20 && npm run rebuildExample && ANDROID_SERIAL=${emulatorId} npm run android")
                        } finally {
                            // Free the ~7GB headless qemu before the iOS stages/gates
                            // run. The post{always{}} block is the safety net for
                            // failures in earlier stages (CA-143485).
                            shutdownEmulator()
                        }
                    }
                }
            }
        }
        stage('Build iOS - xcode') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Building on xcode ..'
                script{
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        runIosTests(true, false)
                    }
                }
            }
        }
        // 'Build Android - gradle' stage removed — it was a no-op stub (the real
        // gradle build was commented out, pinned to facebook/react-native#49428).
        // Android build coverage is the 'Build Android - npm android' stage plus
        // the develop-only 'Sample Build Android (Gate)'.

        stage('Test') {
            when { anyOf { branch 'feature/*'; branch 'develop'; branch 'main' } }
            steps {
                echo 'Running Expo Config Plugin unit tests (npm run test:plugin)..'
                script {
                    echo "genBuild:${genBuild}"
                    if (genBuild) {
                        // node --test over plugin/__tests__ (withConnectNSE / NCE /
                        // AndroidConfig). test:plugin first runs build:plugin (tsc),
                        // so deps from the earlier 'npm rebuild' stage must be present.
                        runCMD("cd ${buildDir} && nvm use 20 && npm run test:plugin")
                    }
                }
            }
        }
        stage('Sample Build iOS (Gate)') {
            // CI gate `ios-sample-build-success` (PES-4002 IDF §CI Gates, CA-143485).
            // Installs the candidate package fresh into a standalone copy of the
            // RN 0.82 bare-workflow host and builds it with xcodebuild. A red gate
            // marks the build FAILURE and blocks the beta publish in this run
            // (verifyPublishGates() in the Publish Beta stage). The production
            // publish on main is gated transitively: it only republishes a beta
            // version that passed these gates on develop — the same merged code
            // would build identically on main, so the gates run on develop only.
            //
            // catchError (not a plain failure) so the Android gate below still
            // runs and reports its own signal even when iOS is red.
            when { branch 'develop' }
            steps {
                script {
                    if (genBuild) {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                            prepareSampleHost()
                            sampleBuildIos()
                            iosSampleBuildSuccess = true
                        }
                        if (!iosSampleBuildSuccess) {
                            notifyGateFailure('ios-sample-build-success',
                                "iOS sample build failed for ${name} ${env.GIT_BRANCH} — beta publish (and therefore production) is blocked until green.")
                        }
                        echo "ios-sample-build-success=${iosSampleBuildSuccess}"
                    } else {
                        echo "genBuild:${genBuild} — skipping iOS sample-build gate"
                    }
                }
            }
        }
        stage('Sample Build Android (Gate)') {
            // CI gate `android-sample-build-success` (PES-4002 IDF §CI Gates,
            // CA-143485). Same standalone RN 0.82 host as the iOS gate; builds
            // with the host's wrapper-pinned Gradle + AGP versions. develop-only
            // for the same reason as the iOS gate above.
            when { branch 'develop' }
            steps {
                script {
                    if (genBuild) {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                            prepareSampleHost()
                            sampleBuildAndroid()
                            androidSampleBuildSuccess = true
                        }
                        if (!androidSampleBuildSuccess) {
                            notifyGateFailure('android-sample-build-success',
                                "Android sample build failed for ${name} ${env.GIT_BRANCH} — beta publish (and therefore production) is blocked until green.")
                        }
                        echo "android-sample-build-success=${androidSampleBuildSuccess}"
                    } else {
                        echo "genBuild:${genBuild} — skipping Android sample-build gate"
                    }
                }
            }
        }
        stage('Sample Build iOS Expo (Gate)') {
            // CI gate `expo-ios-sample-build-success` (CA-144315). Builds the
            // in-tree Expo sample: `expo prebuild` runs the Config Plugin
            // (ConnectNSE + ConnectNCE provisioning — only exercisable in the
            // Expo path) and the app compiles for the simulator. prepareExpoHost
            // also runs `expo export`, so a @shared / Metro-resolver regression
            // fails here too. develop-only, same rationale as the gates above.
            when { branch 'develop' }
            steps {
                script {
                    if (genBuild) {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                            prepareExpoHost()
                            expoSampleBuildIos()
                            expoIosSampleBuildSuccess = true
                        }
                        if (!expoIosSampleBuildSuccess) {
                            notifyGateFailure('expo-ios-sample-build-success',
                                "Expo iOS sample build failed for ${name} ${env.GIT_BRANCH} — beta publish (and therefore production) is blocked until green.")
                        }
                        echo "expo-ios-sample-build-success=${expoIosSampleBuildSuccess}"
                    } else {
                        echo "genBuild:${genBuild} — skipping Expo iOS sample-build gate"
                    }
                }
            }
        }
        stage('Sample Build Android Expo (Gate)') {
            // CI gate `expo-android-sample-build-success` (CA-144315). Same
            // in-tree Expo host; verifies the SDK's Android (FCM) autolinking +
            // gradle wiring under an Expo prebuild. develop-only.
            when { branch 'develop' }
            steps {
                script {
                    if (genBuild) {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                            prepareExpoHost()
                            expoSampleBuildAndroid()
                            expoAndroidSampleBuildSuccess = true
                        }
                        if (!expoAndroidSampleBuildSuccess) {
                            notifyGateFailure('expo-android-sample-build-success',
                                "Expo Android sample build failed for ${name} ${env.GIT_BRANCH} — beta publish (and therefore production) is blocked until green.")
                        }
                        echo "expo-android-sample-build-success=${expoAndroidSampleBuildSuccess}"
                    } else {
                        echo "genBuild:${genBuild} — skipping Expo Android sample-build gate"
                    }
                }
            }
        }
        stage('Update Example Applications') {
            when { anyOf { branch 'feature/*'; branch 'develop'; } }
            steps {
                echo 'Update local example applications without using yalc..'
                script{
                    if (genBuild) {
                        updateExamplesApps()
                    }
                }
            }
        }
        stage('Publish Feature') {
            when { branch 'feature/*'}
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
                        // CA-143485: a red sample-build gate blocks the beta
                        // publish here with an explicit error. Since production
                        // only republishes existing beta versions, this is also
                        // what gates the `latest` publish.
                        verifyPublishGates()
                        updateLibraryDependencies(true)
                        publishBeta()
                    }
                    getSlackReport(false)
                }
            }
        }
        stage('Publish Sample App') {
            // Publishes the sample apps (Examples/bare-workflow + Examples/expo)
            // to the public repo's `next` branch. Decoupled from the prod
            // release: no version bump, no npm publish, no tags, never pushes `main`.
            //
            // Gating: fires ONLY on the auto-version-bump commit that
            // follows every merge to develop (subject:
            // "Beta ReactNativeConnect build: X.Y.Z"). This guarantees:
            //   • exactly one publish per merge (not two — see CA-144313
            //     review thread for why the previous changeset-based
            //     trigger would double-publish),
            //   • the sample on `next` is always pinned to a properly
            //     published SDK beta version (the bump just committed),
            //   • test automation against `next` never observes a
            //     transient state pinned to a not-yet-published version.
            when {
                allOf {
                    branch 'develop'
                    expression {
                        def subject = sh(
                            returnStdout: true,
                            script: 'git log -1 --pretty=%s'
                        ).trim()
                        return subject ==~ /Beta ReactNativeConnect build: \d+\.\d+\.\d+/
                    }
                }
            }
            steps {
                echo 'Publish sample apps (bare-workflow + expo) to public repo (next branch)....'
                script {
                    // NOTE: deliberately NOT guarded by `if (genBuild)`. This
                    // stage's `when` fires ONLY on the auto-version-bump commit
                    // ("Beta ReactNativeConnect build: X.Y.Z"), which is exactly
                    // the commit that createBuild() forces genBuild=false for (to
                    // break the publish→commit→re-trigger loop). Guarding on
                    // genBuild here would mean the publish could never run. The
                    // `when` condition is the gate; publishSampleApp() clones the
                    // public repo itself and reads ./package.json from the
                    // workspace checkout, so it doesn't need checkoutRepos().
                    publishSampleApp()
                }
            }
        }
        stage('Publish Release') {
            // Production publish: transforms the beta package into the public
            // `react-native-acoustic-connect` package and ships it to the npm
            // `latest` dist-tag via the tag-push → GitHub Actions Trusted
            // Publishers flow. Restored by CA-143485 (disabled since v16.x).
            //
            // Gating happens upstream: the sample-build gates run on develop
            // and block the beta publish there (verifyPublishGates() in the
            // Publish Beta stage). publishRelease() never bumps — it only
            // republishes a version that already passed the gates as a beta.
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
        stage('Post-Publish Smoke') {
            // CI gate `npm-package-install-success` (PES-4002 IDF §CI Gates).
            // Installs the version that just published from the npm registry
            // into a fresh standalone RN 0.82 host and verifies the installed
            // version + entry-point resolution. npm has no rollback — a failure
            // here alerts #sdk-ci-react-native-bender for a forward-fix patch publish
            // (see RELEASE.md).
            when { branch 'main' }
            steps {
                script {
                    if (genBuild) {
                        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                            postPublishSmoke()
                            npmPackageInstallSuccess = true
                        }
                        if (!npmPackageInstallSuccess) {
                            notifyGateFailure('npm-package-install-success',
                                "Post-publish smoke failed for react-native-acoustic-connect@${currentVersion}. npm publish cannot be rolled back — follow the forward-fix patch runbook (RELEASE.md) and file a follow-up ticket.")
                        }
                        echo "npm-package-install-success=${npmPackageInstallSuccess}"
                    } else {
                        echo "genBuild:${genBuild} — skipping post-publish smoke"
                    }
                }
            }
        }
    }
    post {
        // Safety net: guarantee the emulator (and any orphaned A_34_RN instance)
        // is torn down even when a stage fails BEFORE the inline shutdown in
        // 'Build Android - npm android' runs. Without this, a failed/aborted run
        // leaked a ~7GB headless qemu that starved later builds and intermittently
        // hung the agent on npm run rebuild / xcodebuild (CA-143485).
        always {
            script {
                // Only attempt teardown on genBuild runs — those are the only
                // ones that start an emulator. Skips the adb/pkill/killall sweep
                // on non-build runs (auto-version-bump commit, staging), where no
                // emulator was launched and a stray `killall node` could touch a
                // concurrent job.
                if (genBuild) {
                    shutdownEmulator()
                }
            }
        }
    }
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

// GitHub Actions publish tracking
@Field def githubActionsUrl         = "Not available"
@Field def npmPublishStatus         = "Not started"
@Field def npmPublishedVersion      = ""

// Version stuff
@Field def currentVersion
@Field def srcBranch        = ""

// Commit stuff
@Field def commitDesciption = ""

// Directory paths
@Field def tempTestDir      = "${name}Build"
@Field def buildDir         = "${tempTestDir}/react-native-acoustic-connect"
@Field def testAppDir       = "${buildDir}/example"
@Field def examplesAppsDir  = "${buildDir}/Examples"
@Field def releaseDir       = "${tempTestDir}/react-native-acoustic-connect-prod"
@Field def buildIosDir      = "${testAppDir}/ios/derived"

// CI sample-build gates + post-publish smoke (CA-143485, PES-4002 IDF §CI Gates).
// The gate booleans drive verifyPublishGates(): the production publish on main
// is blocked unless both sample builds went green earlier in the same run.
@Field def sampleHostDir             = "${tempTestDir}/sample-host"
@Field def sampleHostPrepared        = false
@Field def iosSampleBuildSuccess     = false
@Field def androidSampleBuildSuccess = false
@Field def npmPackageInstallSuccess  = false

// Expo sample-build gates (CA-144315). Unlike the bare-workflow gates above —
// which install the candidate tarball into a standalone host — the Expo sample
// consumes the SDK via `file:../..` and is never published standalone, so it is
// built IN-TREE against the freshly-built in-tree SDK. The Config Plugin
// (ConnectNSE + ConnectNCE provisioning) only runs in the Expo path, so these
// gates are the CI coverage for plugin/prebuild regressions. No EAS and no real
// credentials: a synthesized ConnectConfig.json + simulator/unsigned builds.
@Field def expoAppPath                   = "Examples/expo"
@Field def expoHostPrepared              = false
@Field def expoIosSampleBuildSuccess     = false
@Field def expoAndroidSampleBuildSuccess = false

// Sample-app publish (decoupled from prod release; no npm)
//
// NOTE — `publicRepoDir` used to share its workspace path with the legacy
// `releaseDir`. CA-143485 revived the prod release pipeline and resolved
// the documented clash via option (a): `releaseDir` now carries a `-prod`
// suffix (see above) and checkoutRepos() clones into that explicit
// directory. The two publish paths can no longer race over one checkout
// (they also run on mutually exclusive branches: sample-app on develop,
// prod release on main).
@Field def sampleAppPath  = "Examples/bare-workflow"
@Field def publicRepoUrl  = "git@github.com:go-acoustic/react-native-acoustic-connect.git"
@Field def publicRepoDir  = "${tempTestDir}/react-native-acoustic-connect"
@Field def sampleBranch   = "next"

// Build information
@Field def genBuild  = true

// Test platform
@Field def platform       = "iOS Simulator,name=iPhone 14 Plus,OS=16.0"
@Field def platformName   = platform.replaceAll(/\s|,|=|\./, "_")
@Field def platformLatest = "16.0"


@Field def emulatorName   = "A_34_RN"
@Field def emulatorPorts  = "5600,5601"
@Field def emulatorId     = "emulator-5600"

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
    platform = "iOS Simulator,name=iPhone 17 Pro,OS=${platformLatest}"

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

    def BRCause   = currentBuild.rawBuild.getCause(jenkins.branch.BranchEventCause)
    def PRCause   = currentBuild.rawBuild.getCause(org.jenkinsci.plugins.github.pullrequest.GitHubPRCause)
    def SCMCause  = currentBuild.rawBuild.getCause(hudson.triggers.SCMTrigger$SCMTriggerCause)
    def UserCause = currentBuild.rawBuild.getCause(hudson.model.Cause$UserIdCause)

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
    // Native arch (arm64 on Apple-Silicon agents). Previously forced through
    // Rosetta as the x86_64 simulator slice (`arch -x86_64`), which roughly
    // tripled the build time and tested a slice neither sample-build gate uses
    // (see sampleBuildIos). Consumers ship the native slice, so build that.
    String xcodebuildCMD   = "xcrun"
    String workspacePath   = "${testAppDir}/ios/AcousticConnectRNExample.xcworkspace"
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
        echo "the scheme for building is: AcousticConnectRNExample"
        runCMD("${xcodebuildCMD} xcodebuild -version")
        // CA-143485: build-only (no `test` action) → use a GENERIC simulator
        // destination instead of a concrete `name=…,OS=…` device. A concrete
        // destination makes xcodebuild resolve+prepare that device through
        // CoreSimulator before doing anything, which intermittently hung here
        // (zero output, never returns). `generic/platform=iOS Simulator` compiles
        // for the simulator SDK without selecting/booting a device. When on-device
        // tests are restored, the `test` action will need a concrete destination
        // again (see the commented unit-test invocation below).
        runCMD("${xcodebuildCMD} xcodebuild -workspace ${workspacePath} -scheme AcousticConnectRNExample -derivedDataPath ${buildIosDir} -configuration Debug -destination 'generic/platform=iOS Simulator' -UseModernBuildSystem=YES SUPPORTS_MACCATALYST=NO")
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
    runCMD("cd ${testAppDir} && npm install")
    // runCMD("cd ${testAppDir}/ios && pod update")
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
        runCMD("env ANDROID_SERIAL=${emulatorId} /Users/Shared/Developer/gradle-8.12/bin/gradle -b \"${testAppDir}/android/build.gradle\" --stacktrace --continue --no-daemon --warning-mode all clean build -Dorg.gradle.jvmargs=-Xmx1536m -Duser.country=US -Duser.language=en")
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

def setupEmulator() {
    runCMD("adb start-server")
    // launch emulator
    String cmmmd = "${ANDROID_HOME}/emulator/emulator -avd ${emulatorName} -engine auto -wipe-data -no-cache -memory 3072 -no-snapshot-save -no-window -ports ${emulatorPorts} &sleep 60s"
    runCMD(cmmmd)

    // Wait for the emulator to appear in the list of devices
    def counter = 0
    while (!sh(script: "adb devices | grep emulator", returnStdout: true).trim()) {
        if (counter >= 60) {
            error "Emulator did not start within the expected time."
        }
        sh script: "sleep 5"
        counter += 5
    }

    runCMD("adb devices")
}

def isAnotherJobRunning() {
    def currentJobName = currentBuild.rawBuild.getParent().getName()
    echo "Checking if another build is running for job: ${currentJobName}"

    def currentJob = Jenkins.instance.getItemByFullName(currentJobName)
    if (currentJob == null) {
        echo "Job not found: ${currentJobName}"
        return false
    }

    if (currentJob.builds == null || currentJob.builds.isEmpty()) {
        echo "No builds found for the current job."
        return false
    }

    def isRunning = false
    currentJob.builds.each { build ->
        if (build.isBuilding() && build != currentBuild.rawBuild) {
            echo "Another build is running: Build #${build.number}"
            isRunning = true
        }
    }

    if (!isRunning) {
        echo "No other builds are running for job: ${currentJobName}"
    }

    return isRunning
}

def shutdownEmulator() {
    // Targeted teardown of THIS job's emulator. emulator-5600 is our fixed
    // console port; the `-avd A_34_RN` match also reaps any orphaned instance of
    // OUR AVD left behind by an earlier crashed/aborted run — without touching
    // any other emulator on the host. Safe to run unconditionally (incl. while a
    // sibling build is active). returnStatus + `|| true` so "nothing to kill" is
    // a clean no-op rather than a stage failure.
    sh(script: "adb -s ${emulatorId} emu kill || true", returnStatus: true)
    sh(script: "pkill -f 'avd ${emulatorName}' || true", returnStatus: true)

    // Lingering Metro/node has no per-job handle, so only sweep it when no other
    // build of THIS job is running — never kill a concurrent run's bundler.
    // (Deliberately NOT a blanket `pkill -f qemu-system`: the AVD-scoped pkill
    // above already clears our leak without risking other jobs' emulators.)
    if (isAnotherJobRunning() == false) {
        sh(script: "killall node || true", returnStatus: true)
    } else {
        echo "Another ${name} build is running — reaped our ${emulatorName} emulator only, left node alone."
    }
}

def checkEmulatorReady() {
    sh script: "adb start-server"

    // If our specific emulator isn't already attached, set it up. The
    // previous call here was `setupEmulatorPort(emulatorName, emulatorPorts)`,
    // which referenced a helper that no longer exists anywhere (not in
    // this file, not in jenkins-shared@master). That code path was latent
    // because the CI host typically has a warm emulator and this branch
    // was never taken — exposed by the bare-workflow CI getting further
    // than earlier feature-branch runs after the gradle 8.12 → 9.0.0
    // wrapper bump. setupEmulator() above already does the right thing
    // (start adb, launch the configured AVD at emulatorPorts, wait for
    // adb to see it).
    if (!sh(script: "adb devices", returnStdout: true).contains("${emulatorId}")) {
        setupEmulator()
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
    def examplePackageFile = "${buildDir}/example/package.json"
    def exampleFileContent = readFile "${examplePackageFile}"
    Map exampleJsonContent = (Map) new JsonSlurper().parseText(exampleFileContent)
    exampleJsonContent.dependencies.put("react-native-acoustic-connect", currentVersion)
    def exampleJson = JsonOutput.toJson(exampleJsonContent)
    exampleJson = JsonOutput.prettyPrint(exampleJson)
    writeFile(file:"${examplePackageFile}", text: exampleJson)
    def updatedExamplePackageFile = readFile "${examplePackageFile}"
    echo "Updated file"
    echo "${updatedExamplePackageFile}"

    // Update the bare-workflow sample app package.json too. It is the
    // partner-facing sample + test-automation target (published to the public
    // repo's `next` branch), so its SDK dependency must track the version bump
    // alongside example/ — otherwise it pins to a stale build.
    def sampleAppPackageFile = "${buildDir}/${sampleAppPath}/package.json"
    def sampleAppFileContent = readFile "${sampleAppPackageFile}"
    Map sampleAppJsonContent = (Map) new JsonSlurper().parseText(sampleAppFileContent)
    sampleAppJsonContent.dependencies.put("react-native-acoustic-connect", currentVersion)
    def sampleAppJson = JsonOutput.prettyPrint(JsonOutput.toJson(sampleAppJsonContent))
    writeFile(file:"${sampleAppPackageFile}", text: sampleAppJson)
    def updatedSampleAppPackageFile = readFile "${sampleAppPackageFile}"
    echo "Updated file"
    echo "${updatedSampleAppPackageFile}"
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
    def mavenUrl = "https://repo1.maven.org/maven2/io/github/go-acoustic/${libName}/maven-metadata.xml"
    def versionFilter = isBeta ?
        "grep '<version>.*-beta</version>' | tail -1" :
        "grep '<version>' | grep -v beta | grep -v unspecified | tail -1"
    def version = runCMD("curl -fL ${mavenUrl} | ${versionFilter} | cut -d '>' -f2 | cut -d '<' -f1").trim()
    if (!version) {
        error("Failed to resolve latest ${isBeta ? 'beta' : 'release'} version for ${libName} from ${mavenUrl}")
    }
    return version
}

def downloadAndroidLatestVersion(isBeta, libName, libVersion) {
    def mavenUrl = "https://repo1.maven.org/maven2/io/github/go-acoustic/${libName}/${libVersion}/${libName}-${libVersion}.aar"
    // Download files
    runCMD("cd ${buildDir} && curl -fL ${mavenUrl} --output temp${libName}.zip")
}

def runCMD(commnd) {
    echo "${commnd}"
    def OUUUTTPT = sh (
        script: """
        #!/bin/bash -l
        export NVM_DIR="\$HOME/.nvm"
        [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
        ${commnd}
        """,
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

def updateExamplesApps() {
    updateExamplesAppsHelper("AwesomeProjectWithoutFramework_0_76_9")
    updateExamplesAppsHelper("SampleUI")
}

def updateExamplesAppsHelper(appName) {
    // Remove current version
    cleanMkDir("${examplesAppsDir}/${appName}")
    // Copy over new version
    runCMD("cp -R ${examplesAppsDir}/${appName}_yalc/ ${examplesAppsDir}/${appName}")
    // Remove extra items
    cleanMkDir("${examplesAppsDir}/${appName}/.yalc")
    cleanMkDir("${examplesAppsDir}/${appName}/node_modules")
    cleanMkDir("${examplesAppsDir}/${appName}/package-lock.json")
    cleanMkDir("${examplesAppsDir}/${appName}/yalc.lock")
    cleanMkDir("${examplesAppsDir}/${appName}/yark.lock")
    // Remove yalc reference
    runCMD('jq \'.dependencies["react-native-acoustic-connect"] = "*"\' package.json > temp.json && mv temp.json package.json')
    runCMD("sed -i '' '/\"updateYalc\": \"yalc update react-native-acoustic-connect && cd ios && pod install && cd ..\"/d' package.json")
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
        // Clone into the -prod suffixed dir so the prod release checkout can
        // never collide with publishSampleApp()'s clone of the same repo
        runCMD("cd ${tempTestDir} && git clone git@github.com:go-acoustic/react-native-acoustic-connect.git -b main react-native-acoustic-connect-prod")
    }
}

def gitPush(path, commitMsg, tagMsg, branch, commitMsg2, addPaths = null) {
    echo "Git Push for: ${path}"
    if (addPaths) {
        // Scoped publish commit: stage ONLY the intended outputs (the version
        // bumps + CHANGELOG passed in `addPaths`).
        //
        // The previous blanket `git add . -A` + `git commit -a` recorded the
        // ENTIRE dirty build workspace. That repeatedly shipped a develop HEAD
        // with the native module gutted: build/publish steps leave the tree
        // dirty — tracked SDK source under android/** and ios/** ends up removed
        // from the working copy, and example build artifacts (Hermes .hbc,
        // Xcode derived data, bundled assets) appear untracked — so the commit
        // deleted the source and swept in the artifacts. e.g. beta build
        // 337d3afd deleted ios/HybridAcousticConnectRN.swift, ios/Bridge.h and
        // the whole android/ tree, breaking every downstream pod install /
        // gradle build until it was hand-reverted (same as the earlier
        // c7565b7b). Staging an explicit pathspec — and discarding everything
        // else before the rebase/push — makes the beta commit exactly the bump.
        runCMD('''cd \"''' + path + '''\" && git add ''' + addPaths)
        runCMD('''cd \"''' + path + '''\" && git commit -m \"''' + commitMsg + '''\" -m \"''' + commitMsg2 + '''\"''')
        // Restore any other tracked working-tree changes (removed source, etc.)
        // so the pull --rebase / push below run on a clean tree and never carry
        // them. Untracked build artifacts are simply left uncommitted.
        runCMD('''cd \"''' + path + '''\" && git checkout -- .''')
    } else {
        // Full-tree commit (release repo): publishRelease() deliberately rebuilds
        // releaseDir's contents (git rm -f -r . && git add . -A) before calling
        // this, so the whole tree IS the intended change.
        runCMD('''cd \"''' + path + '''\" && git add . -A''')
        runCMD('''cd \"''' + path + '''\" && git commit -a -m \"''' + commitMsg + '''\" -m \"''' + commitMsg2 + '''\"''')
    }

    // Tag repos
    echo "Tag repos"
    runCMD('''cd \"''' + path + '''\" && git tag -f \"''' + tagMsg + '''\" -m \"''' + commitMsg2 + '''\"''')

    // Pull from git
    echo "Pull from git"
    // --autostash: the scoped commit + `git checkout -- .` above clean the tree,
    // but a tracked asset can be re-dirtied AFTER that cleanup — the Android SDK
    // config processing rewrites android/src/main/assets/*.properties|*.json with
    // a fresh timestamp header, and a lingering build/daemon touch leaves the tree
    // dirty by the time we rebase. A plain `git pull --rebase` then aborts with
    // "cannot pull with rebase: You have unstaged changes" and skips the whole
    // publish (incl. Publish Sample App). --autostash shelves that residual churn,
    // rebases onto origin, and restores it. The push below still ships only the
    // committed bump, and the next run re-clones fresh so the shelved residue is
    // discarded.
    runCMD('''cd \"''' + path + '''\" && git pull --rebase --autostash origin \"''' + branch + '''\"''')

    // Push to git
    echo "Push to git"
    // IMPORTANT: Push branch BEFORE tags so workflow file exists when tag triggers GitHub Actions
    runCMD('''cd \"''' + path + '''\" && git push -f --set-upstream origin \"''' + branch + '''\"''')
    runCMD('''cd \"''' + path + '''\" && git push -f --tags''')
}

// "Publish the sample apps (Examples/bare-workflow AND Examples/expo) to the
//  public go-acoustic repo on the `next` branch. Intentionally decoupled from
//  publishRelease(): no version bump, no npm publish/pack, no tags, and it
//  never pushes `main`. Copies git-tracked files only (via `git archive`), so
//  untracked QA ConnectConfig.json and gitignored ios/ android/ node_modules
//  never leak."
def publishSampleApp() {
    echo "Publish sample apps to ${publicRepoUrl} (branch: ${sampleBranch})"

    // Clone the public repo fresh (leave any beta clone from checkoutRepos intact)
    runCMD("mkdir -p ${tempTestDir}")
    removeDir("${publicRepoDir}")
    runCMD("cd ${tempTestDir} && git clone ${publicRepoUrl}")

    // Use the dedicated `next` branch; create it from the public default branch
    // (`main`) on first run.
    runCMD("cd ${publicRepoDir} && (git checkout ${sampleBranch} || git checkout -b ${sampleBranch})")

    // Pin to the version currently in root package.json. On the auto-version-bump
    // commit that gates this stage, that is exactly the version that just published
    // to npm — so cloning `next` gives a reproducible install rather than whatever
    // the registry tags latest at install time.
    def sdkVersion = sh(
        returnStdout: true,
        script: "node -p \"require('./package.json').version\""
    ).trim()
    echo "Pinning samples' react-native-acoustic-connect to ${sdkVersion}"

    // Lay down each sample. Each sample's committed metro.config.js is
    // self-adapting — it resolves `@shared` to the vendored `./shared` when the
    // monorepo sibling `../shared` is absent — so the publish only vendors
    // `./shared` and never rewrites metro.config.js. Per-sample flags:
    // bare-workflow ships a committed native iOS project (drop the workspace
    // Podfile.lock); expo is CNG (ios/ android/ are gitignored and regenerated
    // by `expo prebuild` — nothing native to strip) but its monorepo-only
    // `eas-build-pre-install` hook must be reduced for the standalone copy.
    layDownSample(sampleAppPath, true, false, sdkVersion)
    layDownSample(expoAppPath, false, true, sdkVersion)

    // Lay down the partner-facing run/debug skill (Examples-agnostic — it covers
    // both samples) at the same path so its relative links resolve standalone.
    // `git archive HEAD` ships only committed files, so the scrubbed source is
    // what publishes (no internal JIRA keys / commit SHAs).
    //
    // Archive from the JOB WORKSPACE cwd (identical to layDownSample above) — NOT
    // `${buildDir}`. This stage deliberately skips checkoutRepos(), so the
    // `${buildDir}` sub-clone does not exist here; `git -C ${buildDir}` failed
    // silently (empty stream → tar exits 0), so the skill never published while
    // the samples did. The cwd IS the develop checkout (layDownSample archives
    // Examples/ from it), and it has .claude/skills/run-demo-push committed.
    //
    // Pre-flight guard: `git archive | tar` exits 0 even on an empty stream, so
    // a future rename/removal of the skill path would silently no-op again (the
    // same class of failure as the buildDir bug). Assert the path is tracked
    // first — runCMD's `sh` throws on non-zero, so a missing path fails the
    // stage LOUDLY instead.
    runCMD("git ls-files --error-unmatch .claude/skills/run-demo-push > /dev/null")
    removeDir("${publicRepoDir}/.claude/skills/run-demo-push")
    runCMD("git archive HEAD .claude/skills/run-demo-push | tar -x -C ${publicRepoDir}")

    // Commit + push to `next` ONLY. No tags, no force, never `main`.
    runCMD("cd ${publicRepoDir} && git add -A")
    runCMD('''cd ''' + publicRepoDir + ''' && git commit -m "docs: update sample apps (SDK ''' + sdkVersion + ''')" || echo "No sample app changes to publish"''')
    runCMD("cd ${publicRepoDir} && git push --set-upstream origin ${sampleBranch}")

    echo "Sample apps published to ${sampleBranch} (SDK ${sdkVersion})"
}

// "Lay one sample app into the public-repo checkout: replace its subtree with
//  git-tracked files, vendor the shared UI, pin the SDK dependency to the
//  published version, and regenerate a standalone lockfile. The sample's
//  committed (self-adapting) metro.config.js handles standalone @shared, so this
//  does not rewrite it. Shared by the bare-workflow and Expo publishes."
def layDownSample(samplePath, dropPodfileLock, fixEasPreInstall, sdkVersion) {
    echo "Laying down ${samplePath}"

    // Replace the sample subtree so deletions propagate, then lay down committed
    // files only. `git archive HEAD` exports exactly what is tracked at the built
    // commit — untracked (ConnectConfig.json) and gitignored (ios/, android/,
    // node_modules/) paths are excluded by construction.
    removeDir("${publicRepoDir}/${samplePath}")
    runCMD("git archive HEAD ${samplePath} | tar -x -C ${publicRepoDir}")

    // Vendor the cross-sample UI (Examples/shared) into the published sample as a
    // `./shared` subdirectory so the app's `@shared/*` imports resolve standalone.
    // The committed metro.config.js already aliases `@shared` to `./shared` when
    // the monorepo sibling `../shared` is absent, so no metro rewrite is needed.
    // --strip-components=1 drops the leading `Examples/` so it lands at <sample>/shared.
    runCMD("git archive HEAD Examples/shared | tar -x --strip-components=1 -C ${publicRepoDir}/${samplePath}")

    // Drop the committed Podfile.lock for samples that ship a native iOS project —
    // its EXTERNAL SOURCES paths (../../../node_modules/react-native/...) are
    // workspace-specific and don't resolve in a standalone clone; `pod install`
    // regenerates it correctly on first checkout. (Expo has no committed ios/.)
    if (dropPodfileLock) {
        runCMD("rm -f ${publicRepoDir}/${samplePath}/ios/Podfile.lock")
    }

    def samplePkgPath = "${publicRepoDir}/${samplePath}/package.json"

    // Pin the SDK dependency to the published version. Source declares it as `*`
    // (bare-workflow) or `file:../..` (expo) so workspace dev resolves the in-tree
    // SDK; standalone it must be a concrete version off the registry.
    runCMD("""sed -i.bak 's#"react-native-acoustic-connect": "[^"]*"#"react-native-acoustic-connect": "${sdkVersion}"#' "${samplePkgPath}" """)
    runCMD("rm -f ${samplePkgPath}.bak")

    // Expo only: the source `eas-build-pre-install` builds the SDK FROM the monorepo
    // (`... && cd ../.. && npm ci && npm run build:plugin`) — meaningless standalone
    // where the SDK is an installed npm dependency. Reduce it to just materializing
    // ConnectConfig.json from EAS env (eas-write-connect-config.mjs).
    if (fixEasPreInstall) {
        runCMD("""sed -i.bak 's#"eas-build-pre-install": "[^"]*"#"eas-build-pre-install": "node ./scripts/eas-write-connect-config.mjs"#' "${samplePkgPath}" """)
        runCMD("rm -f ${samplePkgPath}.bak")
        // Fail fast if the patch was a no-op (regex drift / key renamed): the
        // sed exits 0 even when it matches nothing, which would silently ship
        // the monorepo bootstrap (`cd ../.. && npm ci && npm run build:plugin`)
        // in the standalone hook and break EAS. The reduced value has no
        // `cd ../..`, so its survival means the replacement didn't take.
        runCMD("""if grep -qF 'cd ../..' "${samplePkgPath}"; then echo "ERROR: eas-build-pre-install still bootstraps the monorepo after patch (${samplePath})"; exit 1; fi""")
    }

    // Generate a STANDALONE lockfile (not a workspace one), so customers cloning
    // `next` get deterministic installs. --package-lock-only skips the install.
    // --ignore-scripts is REQUIRED: npm 11 still fires lifecycle scripts under
    // --package-lock-only, but node_modules is never populated, so the Expo
    // sample's `postinstall: patch-package` hook would exec a binary that isn't
    // installed and exit 127. Lockfile generation must not run scripts; skipping
    // them does not change the resolved dependency tree. (The patch is still
    // applied on real installs via `postinstall` and in EAS via
    // `eas-build-post-install` — see Examples/expo/patches/README.md.)
    runCMD("cd ${publicRepoDir}/${samplePath} && npm install --package-lock-only --no-workspaces --no-audit --no-fund --ignore-scripts")
}

// ---------------------------------------------------------------------------
// CI sample-build gates + post-publish smoke (CA-143485, PES-4002 IDF §CI Gates)
// ---------------------------------------------------------------------------

// "Pack the candidate package and install it fresh into a standalone copy of
//  the RN 0.82 bare-workflow host (Examples/bare-workflow). Shared by both
//  sample-build gate stages — idempotent within a build."
def prepareSampleHost() {
    if (sampleHostPrepared) {
        echo "Sample host already prepared at ${sampleHostDir}"
        return
    }

    getLibVersion()
    def tgzFile = "react-native-acoustic-connect-${currentVersion}.tgz"
    echo "Packing candidate package: ${tgzFile}"
    runCMD("cd ${buildDir} && nvm use 20 && npm pack")

    echo "Creating standalone RN 0.82 host from ${sampleAppPath}"
    cleanMkDir("${sampleHostDir}")
    // git archive exports tracked files only — no leaked ConnectConfig.json,
    // node_modules, or developer signing config (same pattern as publishSampleApp)
    runCMD("git -C ${buildDir} archive HEAD ${sampleAppPath} | tar -x --strip-components=2 -C ${sampleHostDir}")
    // Vendor the cross-sample UI (Examples/shared) into the standalone host as a
    // ./shared subdirectory so the app's @shared/* imports resolve without the
    // monorepo sibling — mirrors publishSampleApp.
    runCMD("git -C ${buildDir} archive HEAD Examples/shared | tar -x --strip-components=1 -C ${sampleHostDir}")
    runCMD("cd ${sampleHostDir} && cp ConnectConfig.example.json ConnectConfig.json")
    // The committed Podfile.lock carries workspace-relative EXTERNAL SOURCES
    // paths that don't resolve in a standalone copy — pod install regenerates it
    runCMD("rm -f ${sampleHostDir}/ios/Podfile.lock")

    echo "Installing host dependencies, then the candidate package fresh"
    runCMD("cd ${sampleHostDir} && nvm use 20 && npm install --no-workspaces --no-audit --no-fund")
    runCMD("cd ${sampleHostDir} && nvm use 20 && npm install --no-workspaces --no-audit --no-fund ../react-native-acoustic-connect/${tgzFile}")

    // Keep the repo clone pristine for the later publish git push
    runCMD("rm -f ${buildDir}/${tgzFile}")

    sampleHostPrepared = true
}

// "Gate `ios-sample-build-success`: the candidate package must build inside
//  the RN 0.82 host with the current Xcode toolchain."
def sampleBuildIos() {
    echo "iOS sample build on RN 0.82 host (gate: ios-sample-build-success)"
    runCMD("xcodebuild -version")
    runCMD("cd ${sampleHostDir} && bundle install")
    runCMD("cd ${sampleHostDir} && bundle exec pod install --project-directory=ios")
    def derived = "${sampleHostDir}/ios/derived"
    cleanMkDir("${derived}")
    // CA-143485: build-only gate → generic Simulator destination (no concrete
    // device, so no CoreSimulator prepare step to hang on). See runIosTests.
    runCMD("xcodebuild -workspace ${sampleHostDir}/ios/ConnectBareWorkflowDemo.xcworkspace -scheme ConnectBareWorkflowDemo -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath ${derived} CODE_SIGNING_ALLOWED=NO -UseModernBuildSystem=YES SUPPORTS_MACCATALYST=NO")
}

// "Gate `android-sample-build-success`: the candidate package must build inside
//  the RN 0.82 host with the host's wrapper-pinned Gradle + AGP versions."
def sampleBuildAndroid() {
    echo "Android sample build on RN 0.82 host (gate: android-sample-build-success)"
    runCMD("cd ${sampleHostDir}/android && ./gradlew assembleDebug --no-daemon --stacktrace")
}

// "Prepare the Expo sample IN-TREE (Examples/expo consumes the SDK via
//  file:../.. and is never published standalone, so — unlike prepareSampleHost
//  — there is no tarball install or standalone clone). Synthesizes the
//  gitignored ConnectConfig.json (the Config Plugin throws without a non-empty
//  iOSAppGroupIdentifier) and validates the JS graph bundles via `expo export`
//  — this is the cheap check that catches @shared / Metro-resolver regressions
//  before the heavier native builds. No EAS, no real credentials."
def prepareExpoHost() {
    if (expoHostPrepared) {
        echo "Expo host already prepared at ${buildDir}/${expoAppPath}"
        return
    }
    def expoDir = "${buildDir}/${expoAppPath}"
    echo "Preparing Expo sample host (in-tree, file:../.. SDK)"
    // Config Plugin requires a non-empty App Group; set the canonical value.
    // This App Group is COUPLED TO THE BACKEND APN credential setup, so it must
    // match scripts/eas-write-connect-config.mjs exactly — the same identifier
    // the prebuild bakes into the connectexpodemo/ConnectNSE/ConnectNCE
    // entitlements. ConnectConfig.json is gitignored, so it never leaks into a
    // commit.
    runCMD("cd ${expoDir} && cp ConnectConfig.example.json ConnectConfig.json")
    runCMD('''cd ''' + expoDir + ''' && node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('ConnectConfig.json','utf8'));p.Connect.iOSAppGroupIdentifier='group.co.acoustic.mobile.connect.rn.expodemo';fs.writeFileSync('ConnectConfig.json',JSON.stringify(p,null,4))"''')
    // Standalone install — Examples/expo is NOT an npm workspace member.
    runCMD("cd ${expoDir} && nvm use 20 && npm install --no-workspaces --no-audit --no-fund")
    // The JS bundle resolves the SDK via its `main` (lib/commonjs); ensure it is
    // built. Guarded so we don't rebuild if an earlier stage already produced it.
    if (!fileExists("${buildDir}/lib/commonjs/index.js")) {
        runCMD("cd ${buildDir} && nvm use 20 && npm run build")
    }
    // JS graph check: resolves @shared/* through the Metro alias + blockList and
    // bundles the full app (incl. <Connect> + the SDK via file:../..) to Hermes.
    // Native platforms only — web export would statically render the routes in
    // Node and fail on the SDK's native modules (__fbBatchedBridgeConfig).
    runCMD("cd ${expoDir} && nvm use 20 && npx expo export --platform ios --platform android --output-dir ${tempTestDir}/expo-export-ci")
    expoHostPrepared = true
}

// "Gate `expo-ios-sample-build-success`: `expo prebuild` must generate the
//  ConnectNSE + ConnectNCE Xcode targets (Config Plugin output) and the app
//  must compile for the simulator. Unsigned (CODE_SIGNING_ALLOWED=NO) — the
//  extensions build for the simulator without a provisioning profile."
def expoSampleBuildIos() {
    echo "iOS Expo sample build (gate: expo-ios-sample-build-success)"
    def expoDir = "${buildDir}/${expoAppPath}"
    // prebuild runs the Config Plugin (seeds ios/ incl. ConnectNSE + ConnectNCE).
    // The workspace/scheme name is derived by Expo from app.json `name`
    // ("connect-expo-demo") with non-alphanumerics stripped → "connectexpodemo"
    // (NOT the slug "connect-sample-app"). Keep these in sync with that rule.
    //
    // --no-install: do NOT let `expo prebuild` install CocoaPods itself. Expo's
    // auto-installer runs `pod`/`gem` off the bare PATH; when the agent's bare
    // Ruby/CocoaPods is broken it fails, yet prebuild still exits 0 — leaving no
    // .xcworkspace and a misleading "workspace does not exist" at xcodebuild.
    // Instead we install pods via bundler (Examples/expo/Gemfile), the same
    // proven path as bare-workflow: a pinned CocoaPods in a Ruby that has the
    // stdlib gems (logger/bigdecimal/…) that Ruby 4.0 dropped. A pod-install
    // failure is then fatal and surfaces the real error here.
    runCMD("cd ${expoDir} && nvm use 20 && CI=1 npx expo prebuild --platform ios --clean --no-install")
    runCMD("cd ${expoDir} && bundle install")
    runCMD("cd ${expoDir} && bundle exec pod install --project-directory=ios")
    // Fail fast + visibly if pod install did not produce the workspace.
    runCMD("test -d ${expoDir}/ios/connectexpodemo.xcworkspace")
    def derived = "${expoDir}/ios/derived"
    cleanMkDir("${derived}")
    // CA-143485: build-only gate → generic Simulator destination (no concrete
    // device, so no CoreSimulator prepare step to hang on). See runIosTests.
    runCMD("xcodebuild -workspace ${expoDir}/ios/connectexpodemo.xcworkspace -scheme connectexpodemo -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath ${derived} CODE_SIGNING_ALLOWED=NO -UseModernBuildSystem=YES SUPPORTS_MACCATALYST=NO")
}

// "Gate `expo-android-sample-build-success`: `expo prebuild` + a debug build of
//  the Expo Android project. The Config Plugin is iOS-only; this verifies the
//  SDK's Android (FCM) autolinking + gradle wiring in the Expo context.
//  app.json declares `android.googleServicesFile: ./google-services.json` and
//  the generated project applies the com.google.gms.google-services plugin, so
//  `expo prebuild` validates+copies that file and fails if it is absent. The
//  real file is gitignored, so synthesize the committed placeholder template
//  (structurally valid, package matches app.json -> android.package) before
//  prebuild — enough to satisfy the plugin's compile-time client check; runtime
//  FCM delivery is out of scope for this build gate."
def expoSampleBuildAndroid() {
    echo "Android Expo sample build (gate: expo-android-sample-build-success)"
    def expoDir = "${buildDir}/${expoAppPath}"
    runCMD("cd ${expoDir} && cp google-services.json.template google-services.json")
    runCMD("cd ${expoDir} && nvm use 20 && CI=1 npx expo prebuild --platform android --clean")
    runCMD("cd ${expoDir}/android && ./gradlew :app:assembleDebug --no-daemon --stacktrace")
}

// "Block the beta publish unless every CI sample-build gate is green. Runs in
//  the Publish Beta stage on develop — production (`latest`) is gated
//  transitively because publishRelease() only republishes versions that
//  already shipped as betas. Gate definitions: PES-4002 IDF §CI Gates."
def verifyPublishGates() {
    def gates = [
        'ios-sample-build-success'          : iosSampleBuildSuccess,
        'android-sample-build-success'      : androidSampleBuildSuccess,
        'expo-ios-sample-build-success'     : expoIosSampleBuildSuccess,
        'expo-android-sample-build-success' : expoAndroidSampleBuildSuccess,
    ]
    def red = gates.findAll { !it.value }.collect { it.key }
    if (red) {
        def msg = "Publish BLOCKED — red CI gate(s): ${red.join(', ')}. Fix the sample build(s) and re-run the pipeline (PES-4002 IDF §CI Gates)."
        notifyGateFailure(red.join(', '), msg)
        error(msg)
    }
    echo "All publish gates green: ${gates.keySet().join(', ')}"
}

// "Prepend the new version's CHANGELOG.md entry, generated from the
//  conventional-commit messages since the previous release tag (CA-143485
//  AC-4). Runs against the beta clone's real history after updateLibVersion()
//  has bumped package.json (the entry takes its version from there). The
//  release flow inherits the file through publishRelease()'s rsync, with the
//  beta→public package-name rewrite applied like every other file. Tags in
//  this repo are bare semver (e.g. 19.0.1) — the default tag matching of
//  conventional-changelog handles both bare and v-prefixed tags."
def generateChangelog() {
    echo "Generating CHANGELOG.md entry for ${currentVersion}"
    runCMD("cd ${buildDir} && nvm use 20 && npx -y -p conventional-changelog-cli -p conventional-changelog-conventionalcommits conventional-changelog -p conventionalcommits -i CHANGELOG.md -s -r 1")
}

// "Install the just-published production package from the npm registry into a
//  fresh standalone RN 0.82 host; verify the installed version, the `latest`
//  dist-tag, and entry-point resolution. Gate: npm-package-install-success
//  (PES-4002 IDF §CI Gates). Full runtime `import { Connect }` needs a Metro
//  bundle — compile-level integration is covered by the pre-publish
//  sample-build gates; this step verifies what customers actually fetch.
//  Note: the registry install runs the SDK's postinstall scripts inside the
//  bare host (ConnectConfig.json is provided above), so this gate also fails
//  if a future postinstall change stops being install-safe standalone —
//  that is intentional coverage, not an accident."
def postPublishSmoke() {
    def pkg = "react-native-acoustic-connect"
    echo "Post-publish smoke: ${pkg}@${currentVersion} (gate: npm-package-install-success)"

    def smokeDir = "${tempTestDir}/post-publish-smoke"
    cleanMkDir("${smokeDir}")
    runCMD("git -C ${buildDir} archive HEAD ${sampleAppPath} | tar -x --strip-components=2 -C ${smokeDir}")
    runCMD("cd ${smokeDir} && cp ConnectConfig.example.json ConnectConfig.json")
    runCMD("rm -f ${smokeDir}/ios/Podfile.lock")
    // The host pins the beta package — the production package is what just
    // published. Swap the dependency before installing.
    runCMD('''cd ''' + smokeDir + ''' && node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.dependencies['react-native-acoustic-connect'];fs.writeFileSync('package.json',JSON.stringify(p,null,2))"''')

    // Registry propagation can lag the GitHub Actions publish by a few
    // seconds — poll until the published version is visible (max ~2 min)
    def visible = false
    for (int attempt = 1; attempt <= 12; attempt++) {
        def seen = runCMD("nvm use 20 >/dev/null && npm view ${pkg}@${currentVersion} version 2>/dev/null || true").trim()
        if (seen == "${currentVersion}") {
            visible = true
            break
        }
        echo "${pkg}@${currentVersion} not visible on the registry yet (attempt ${attempt}/12) — waiting 10s"
        sleep 10
    }
    if (!visible) {
        error("Published version ${pkg}@${currentVersion} never became visible on the npm registry")
    }

    def latestTag = runCMD("nvm use 20 >/dev/null && npm view ${pkg} dist-tags.latest").trim()
    if (latestTag != "${currentVersion}") {
        error("npm dist-tag check failed: expected latest=${currentVersion}, got latest=${latestTag}")
    }

    echo "Installing host dependencies + ${pkg}@${currentVersion} from the registry"
    runCMD("cd ${smokeDir} && nvm use 20 && npm install --no-workspaces --no-audit --no-fund")
    runCMD("cd ${smokeDir} && nvm use 20 && npm install --no-workspaces --no-audit --no-fund ${pkg}@${currentVersion}")

    writeFile(file: "${smokeDir}/smoke-check.js", text: """// Post-publish smoke check (CA-143485 AC-3)
const fs = require('fs')
const path = require('path')
const pkgName = process.argv[2]
const expected = process.argv[3]
// fs read instead of require(pkg + '/package.json') — immune to a future
// exports map that doesn't expose ./package.json
const pkgJsonPath = path.join('node_modules', pkgName, 'package.json')
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
if (pkgJson.version !== expected) {
  console.error('FAIL: installed ' + pkgJson.version + ', expected ' + expected)
  process.exit(1)
}
// CJS entry resolution — valid while the package ships a commonjs build
// (react-native-builder-bob always emits one; main: ./lib/commonjs/...)
require.resolve(pkgName)
console.log('OK: ' + pkgName + '@' + pkgJson.version + ' installs and entry point resolves')
""")
    runCMD("cd ${smokeDir} && nvm use 20 && node smoke-check.js ${pkg} ${currentVersion}")

    echo "npm-package-install-success gate passed for ${pkg}@${currentVersion}"
}

// "CI-gate failures alert the same channel as the other pipeline
//  notifications (PES-4002 IDF §CI Gates names #sidekicks-ci, but the squad's
//  actual CI channel is #sdk-ci-react-native-bender — see notifySlack)."
def notifyGateFailure(gateName, message) {
    slackSend(
        channel: '#sdk-ci-react-native-bender',
        color: 'danger',
        message: "🔴 CI gate red: ${gateName}\n${name} ${env.GIT_BRANCH} build #${env.BUILD_NUMBER}\n${message}\n${env.BUILD_URL}"
    )
}

// "Update files for beta"
def updateDescription(isBeta) {
    def title = isBeta ? "Beta" : "Release"
    def commitDesciptionTitle = "${title} ${name} Change Notes:"
    commitDesciption = readFile "latestChanges"
    commitDesciption = "${commitDesciptionTitle} \n" << commitDesciption
    commitDesciption = commitDesciption.replaceAll("\"", "\'")
}

/**
 * Upload tarball to GitHub release
 *
 * This function handles the process of uploading a package tarball (.tgz file) to a GitHub release.
 * It performs the following operations:
 *
 * 1. Checks if a release exists for the specified version/tag
 * 2. Creates the release if it doesn't exist (with version as tag and name)
 * 3. Retrieves the release ID with retry logic for reliability
 * 4. Uploads the tarball file as a release asset
 *
 * @param tgzFilePath - Full path to the tarball file to upload (e.g., "${buildDir}/package-name-1.0.0.tgz")
 * @param version - Version tag for the release (e.g., "18.0.16"). This must match the git tag created earlier.
 * @param repository - GitHub repository in "owner/repo" format (e.g., "aipoweredmarketer/react-native-acoustic-connect")
 *
 * @requires GitHub credentials via 'github.https.appid' credential ID (GITHUB_USER and GITHUB_TOKEN)
 * @requires commitDesciption global variable for release body text
 *
 * Note: This function should be called AFTER git tags are pushed to GitHub, as it relies on
 * the tag existing in the repository to create/find the release.
 */
def uploadToGitHubRelease(tgzFilePath, version, repository) {
    echo "Uploading ${tgzFilePath} to GitHub release ${version} for ${repository}"

    withCredentials([usernamePassword(credentialsId: 'github.https.appid', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
        // Check if release exists, if not create it
        def releaseExists = sh(
            script: """
                curl -s -o /dev/null -w '%{http_code}' \
                -H "Authorization: token ${GITHUB_TOKEN}" \
                https://api.github.com/repos/${repository}/releases/tags/${version}
            """,
            returnStdout: true
        ).trim()

        if (releaseExists == '404') {
            echo "Release ${version} does not exist, creating it..."

            // Use JsonOutput to properly create JSON payload
            def payloadMap = [
                tag_name: version,
                name: version,
                body: commitDesciption,
                draft: false,
                prerelease: false
            ]
            def jsonPayload = JsonOutput.toJson(payloadMap)
            writeFile file: 'release-payload.json', text: jsonPayload

            def createReleaseResponse = sh(
                script: """
                    curl -s -X POST \
                    -H "Authorization: token ${GITHUB_TOKEN}" \
                    -H "Content-Type: application/json" \
                    https://api.github.com/repos/${repository}/releases \
                    -d @release-payload.json
                """,
                returnStdout: true
            ).trim()
            echo "Create release response: ${createReleaseResponse}"

            // Clean up payload file
            sh "rm -f release-payload.json"
        } else {
            echo "Release ${version} already exists (HTTP ${releaseExists})"
        }

        // Get release ID with retry logic
        def releaseId = ""
        def maxRetries = 3
        def retry = 0

        while (retry < maxRetries && releaseId == "") {
            if (retry > 0) {
                echo "Retrying to get release ID (attempt ${retry + 1}/${maxRetries})..."
                sleep 2
            }

            releaseId = sh(
                script: """
                    curl -s \
                    -H "Authorization: token ${GITHUB_TOKEN}" \
                    https://api.github.com/repos/${repository}/releases/tags/${version} | \
                    grep -m 1 '"id":' | head -1 | sed 's/[^0-9]*//g'
                """,
                returnStdout: true
            ).trim()

            retry++
        }

        if (releaseId == "") {
            error("Failed to get release ID for version ${version} after ${maxRetries} attempts")
        }

        echo "Release ID: ${releaseId}"

        // Get filename from path
        def fileName = tgzFilePath.tokenize('/').last()

        // Upload asset
        echo "Uploading asset ${fileName} to release ${releaseId}"
        def uploadResponse = sh(
            script: """
                curl -s -X POST \
                -H "Authorization: token ${GITHUB_TOKEN}" \
                -H "Content-Type: application/gzip" \
                --data-binary @"${tgzFilePath}" \
                "https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${fileName}"
            """,
            returnStdout: true
        ).trim()

        echo "Upload response: ${uploadResponse}"
        echo "Successfully uploaded ${fileName} to GitHub release ${version}"
    }
}

/**
 * Poll GitHub Actions workflow status and wait for npm publish completion
 *
 * This function integrates Jenkins with the GitHub Actions workflow that handles
 * npm publishing via Trusted Publishers. It polls the GitHub Actions API every 10 seconds
 * to check if the workflow triggered by the git tag push has completed.
 *
 * @param version - The version tag to look for (e.g., "18.0.16")
 * @param repository - Repository in "owner/repo" format
 *
 * @requires GitHub credentials via 'github.https.appid'
 *
 * @return Map with workflow information:
 *   - workflowUrl: URL to the GitHub Actions workflow run
 *   - publishStatus: Status of the npm publish ("Success", "Failed", "Timeout", "Not Found")
 *   - publishedVersion: Version that was published (if successful)
 */
def waitForGitHubActionsPublish(version, repository) {
    echo "Waiting for GitHub Actions to publish ${version} to npm..."

    def result = [
        workflowUrl: "Not available",
        publishStatus: "Not Found",
        publishedVersion: ""
    ]

    withCredentials([usernamePassword(credentialsId: 'github.https.appid', usernameVariable: 'GITHUB_USER', passwordVariable: 'GITHUB_TOKEN')]) {
        def maxAttempts = 90  // Wait up to 15 minutes (90 * 10 seconds)
        def attempt = 0
        def workflowCompleted = false
        def workflowStatus = "unknown"

        while (attempt < maxAttempts && !workflowCompleted) {
            attempt++
            echo "Checking GitHub Actions workflow status (attempt ${attempt}/${maxAttempts})..."

            // Get workflow runs for the tag
            def workflowsJson = sh(
                script: """
                    curl -s \
                    -H "Authorization: token ${GITHUB_TOKEN}" \
                    -H "Accept: application/vnd.github.v3+json" \
                    "https://api.github.com/repos/${repository}/actions/runs?event=push&per_page=5"
                """,
                returnStdout: true
            ).trim()

            // Parse JSON to find the workflow for this tag.
            //
            // Match on the publishing workflow's PATH, not just the tag: since
            // CA-143485 the repo carries two tag-triggered workflows —
            // publish.yml (the actual publisher) and publish.public.yml (guarded
            // to the public repo, so it completes as "skipped" here). The API
            // returns runs newest-first, and the skipped run can sort ahead of
            // the real one; matching it would read conclusion "skipped" as a
            // publish failure and fail the build even though npm publish
            // succeeded. `.github/workflows/publish.yml` is the real publisher
            // in BOTH repos (in the public repo, publish.public.yml is installed
            // under that name). Also skip "skipped" runs defensively.
            def workflows = new JsonSlurper().parseText(workflowsJson)
            def relevantRun = workflows.workflow_runs.find { run ->
                (run.head_branch == version || run.name.contains(version)) &&
                run.path == ".github/workflows/publish.yml" &&
                run.conclusion != "skipped"
            }

            if (relevantRun) {
                workflowStatus = relevantRun.status
                def conclusion = relevantRun.conclusion
                result.workflowUrl = relevantRun.html_url

                echo "Workflow status: ${workflowStatus}, conclusion: ${conclusion}"
                echo "Workflow URL: ${result.workflowUrl}"

                if (workflowStatus == "completed") {
                    workflowCompleted = true

                    if (conclusion == "success") {
                        echo "✅ GitHub Actions successfully published version ${version} to npm"
                        result.publishStatus = "Success"
                        result.publishedVersion = version
                        // Mark build as successful for npm publish
                    } else {
                        echo "❌ GitHub Actions workflow failed with conclusion: ${conclusion}"
                        echo "Check the workflow: ${result.workflowUrl}"
                        result.publishStatus = "Failed"
                        // Mark build as failure if npm publishing fails
                        currentBuild.result = 'FAILURE'
                        failed = 1
                    }
                    break
                }
            } else {
                echo "No workflow found yet for tag ${version}"
            }

            if (!workflowCompleted) {
                sleep 10  // Wait 10 seconds before next check
            }
        }

        if (!workflowCompleted) {
            echo "⚠️  Timeout waiting for GitHub Actions workflow to complete"
            echo "The package may still be publishing. Check GitHub Actions manually."
            result.publishStatus = "Timeout"
            currentBuild.result = 'UNSTABLE'
        }
    }

    return result
}

/**
 * Publish beta version to npm via GitHub Actions workflow
 *
 * This is the main beta publishing flow that:
 * 1. Increments patch version in package.json (e.g., 18.0.15 → 18.0.16)
 * 2. Creates npm tarball (.tgz file)
 * 3. Temporarily moves tarball outside repo to avoid committing it
 * 4. Commits version changes and pushes to GitHub with version tag
 * 5. Moves tarball back and uploads to GitHub Release as an asset
 * 6. Waits for GitHub Actions workflow to publish to npm using Trusted Publishers
 *
 * @requires currentVersion - Set by updateLibVersion()
 * @requires commitDesciption - Set by updateDescription()
 * @requires buildDir - Global variable pointing to build directory
 */
def publishBeta() {
    updateLibVersion()

    // CHANGELOG.md entry for the bumped version (committed + tagged by the
    // gitPush below; shipped in the tarball via the package.json `files`
    // allowlist, which explicitly includes CHANGELOG.md)
    generateChangelog()

    // Create npm package tarball
    echo "Creating npm package tarball"
    runCMD('''cd \"''' + buildDir + '''\" && npm pack''')
    def tgzFile = "react-native-acoustic-connect-${currentVersion}.tgz"
    echo "Created package: ${tgzFile}"
    echo "NPM publishing will be handled by GitHub Actions workflow after git push"

    updateDescription(true)
    def commitMsg = "Beta ${name} build: ${currentVersion}"
    echo "push with:"
    echo commitMsg
    echo currentVersion
    echo commitDesciption

    // Temporarily move tarball to temp directory outside build dir before git push
    def tempTarballPath = "${env.WORKSPACE}/../temp_${env.BUILD_NUMBER}_${tgzFile}"
    echo "Moving tarball to temp location: ${tempTarballPath}"
    runCMD('''mv \"''' + buildDir + '''/''' + tgzFile + '''\" \"''' + tempTarballPath + '''\"''')

    // push repos (this creates the tag on GitHub)
    echo "Pushing code and tags to GitHub..."
    // Commit ONLY the publish outputs — the version bumps written by
    // updateLibVersion() (root + example + bare-workflow package.json) and the
    // CHANGELOG.md entry from generateChangelog(). Everything else in the build
    // workspace is left uncommitted (see gitPush's scoped-commit branch for why
    // a blanket `git add . -A` here used to gut the native module on develop).
    def betaPublishPaths = "package.json example/package.json ${sampleAppPath}/package.json CHANGELOG.md"
    gitPush("${buildDir}", commitMsg, currentVersion, srcBranch, commitDesciption, betaPublishPaths)
    echo "Git push completed"

    // Move tarball back for upload
    echo "Moving tarball back to: ${buildDir}/${tgzFile}"
    runCMD('''mv \"''' + tempTarballPath + '''\" \"''' + buildDir + '''/''' + tgzFile + '''\"''')
    echo "Tarball moved back"

    // Verify tarball exists before upload
    def tarballExists = fileExists("${buildDir}/${tgzFile}")
    if (!tarballExists) {
        error("Tarball not found at ${buildDir}/${tgzFile} - cannot upload to GitHub release")
    }
    echo "Tarball verified at: ${buildDir}/${tgzFile}"

    // Upload tarball to GitHub release AFTER tag is pushed
    echo "Starting GitHub release upload..."
    uploadToGitHubRelease("${buildDir}/${tgzFile}", currentVersion, "aipoweredmarketer/react-native-acoustic-connect")
    echo "GitHub release upload completed"

    // Wait for GitHub Actions to publish to npm
    echo "Waiting for GitHub Actions to publish to npm..."
    def publishResult = waitForGitHubActionsPublish(currentVersion, "aipoweredmarketer/react-native-acoustic-connect")

    // Store results in global variables for Slack notification
    githubActionsUrl = publishResult.workflowUrl
    npmPublishStatus = publishResult.publishStatus
    npmPublishedVersion = publishResult.publishedVersion

    echo "GitHub Actions publish check completed"
    echo "Workflow URL: ${githubActionsUrl}"
    echo "Publish Status: ${npmPublishStatus}"
}

/**
 * Publish release version by transforming beta package to public release package
 *
 * This function handles the transformation from the beta package
 * (react-native-acoustic-connect) to the public release package
 * (react-native-acoustic-connect). It:
 *
 * 1. Reads version from beta package (no version bump for releases)
 * 2. Cleans the release repository
 * 3. Copies all files from beta repo to release repo
 * 4. Performs search-and-replace to transform package names:
 *    - Repository URLs: aipoweredmarketer/react-native-acoustic-connect → go-acoustic/react-native-acoustic-connect
 *    - Package names: react-native-acoustic-connect → react-native-acoustic-connect
 *    - Removes "" prefixes from documentation
 *    - Renames podspec file
 * 5. Creates tarball, uploads to GitHub Release
 * 6. Waits for GitHub Actions to publish to npm using Trusted Publishers
 *
 * Note: Release versions MUST already exist in beta before running this.
 * This function only transforms and republishes; it does NOT create new versions.
 *
 * Side effects:
 *   - Completely replaces content of go-acoustic/react-native-acoustic-connect repository
 *   - Creates git commit and tag in release repository
 *   - Uploads tarball to GitHub Release
 *
 * @requires currentVersion - Set by getLibVersion()
 * @requires commitDesciption - Set by updateDescription()
 * @requires releaseDir - Global variable pointing to release directory
 */
def publishRelease() {
    getLibVersion()

    echo "Clean up directory in public repo"
    runCMD("cd ${releaseDir} && git rm -f -r .")

    // .github is excluded: the beta workflows must not ship to the public
    // repo (the sed pass below would corrupt publish.yml's repository guard
    // into one matching neither repo — a triggered-but-skipped run that
    // reports SUCCESS without publishing). The public repo gets its own
    // publish workflow via the explicit copy after the sed pass, same
    // pattern as ca-mce-react-native. RELEASE.md is internal process docs
    // (Jira links, Slack channels) and stays out of the public copy too.
    echo "Copy over changes from beta to public repo"
    echo "rsync -av --exclude='.git' --exclude='.github' --exclude='RELEASE.md' ${buildDir}/. ${releaseDir}"
    runCMD("rsync -av --exclude='.git' --exclude='.github' --exclude='RELEASE.md' ${buildDir}/. ${releaseDir}")

    runCMD('''cd \"''' + releaseDir + '''\" && git add . -A''')

    sleep 30

    // Fail fast if the podspec is missing from the release dir. We no longer
    // rename it (see below), so nothing else in this stage asserts its
    // presence; without this guard a copy failure or future rename would
    // publish a release with no podspec and break iOS consumers silently.
    runCMD("test -f ${releaseDir}/AcousticConnectRN.podspec")

    echo "Search and replace text to fix with public name at react-native-acoustic-connect"
    runCMD("cd ${releaseDir} && git grep -l 'https:\\/\\/github.com\\/aipoweredmarketer\\/react-native-acoustic-connect' | xargs sed -i '' -e 's/https:\\/\\/github.com\\/aipoweredmarketer\\/react-native-acoustic-connect/https:\\/\\/github.com\\/go-acoustic\\/react-native-acoustic-connect/g'")
    runCMD("cd ${releaseDir} && git grep -l 'react-native-acoustic-connect' | xargs sed -i '' -e 's/react-native-acoustic-connect/react-native-acoustic-connect/g'")
    runCMD("cd ${releaseDir} && git grep -l 'connect' | xargs sed -i '' -e 's/connect/connect/g'")
    runCMD("cd ${releaseDir} && git grep -l '' | xargs sed -i '' -e 's///g'")
    // No podspec rename: the podspec is AcousticConnectRN.podspec (s.name =
    // "AcousticConnectRN"), decoupled from the npm package name since CA-97101.
    // The pod is referenced by that name in cli/ios/connect_pods.rb and the
    // bare-workflow Podfile, so it must pass through the transform unchanged.
    // (The old `mv react-native-acoustic-connect.podspec ...` failed at
    // release time because that file no longer exists.)

    // Install the public Trusted Publishers workflow as the public repo's
    // publish.yml (CA-143485). Copied AFTER the sed pass from the pristine
    // beta clone, so the rename pass can never touch it. Its `if` guard is
    // hardcoded to go-acoustic/react-native-acoustic-connect — the npm
    // Trusted Publisher config for the public package must reference
    // workflow `publish.yml` on that repo. Same pattern as
    // ca-mce-react-native's publish.public.yml.
    echo "Copy publish workflow to public repo"
    runCMD("mkdir -p ${releaseDir}/.github/workflows && cp ${buildDir}/.github/workflows/publish.public.yml ${releaseDir}/.github/workflows/publish.yml")

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

    // Create npm package tarball for release
    echo "Creating npm package tarball for release"
    runCMD('''cd \"''' + releaseDir + '''\" && npm pack''')
    def tgzFile = "react-native-acoustic-connect-${currentVersion}.tgz"
    echo "Created release package: ${tgzFile}"
    echo "NPM publishing will be handled by GitHub Actions workflow after git push"

    updateDescription(false)
    def commitMsg = "Release ${name} build: ${currentVersion}"
    echo "push with:"
    echo commitMsg
    echo currentVersion
    echo commitDesciption

    // Temporarily move tarball to temp directory outside release dir before git push
    def tempTarballPath = "${env.WORKSPACE}/../temp_${env.BUILD_NUMBER}_${tgzFile}"
    echo "Moving release tarball to temp location: ${tempTarballPath}"
    runCMD('''mv \"''' + releaseDir + '''/''' + tgzFile + '''\" \"''' + tempTarballPath + '''\"''')

    // push repos (this creates the tag on GitHub)
    echo "Pushing release code and tags to GitHub..."
    // gitPush("${buildDir}", commitMsg, currentVersion, srcBranch, commitDesciption) - there are no changes.
    gitPush("${releaseDir}", commitMsg, currentVersion, "main", commitDesciption)
    echo "Release git push completed"

    // Move tarball back for upload
    echo "Moving release tarball back to: ${releaseDir}/${tgzFile}"
    runCMD('''mv \"''' + tempTarballPath + '''\" \"''' + releaseDir + '''/''' + tgzFile + '''\"''')
    echo "Release tarball moved back"

    // Verify tarball exists before upload
    def tarballExists = fileExists("${releaseDir}/${tgzFile}")
    if (!tarballExists) {
        error("Release tarball not found at ${releaseDir}/${tgzFile} - cannot upload to GitHub release")
    }
    echo "Release tarball verified at: ${releaseDir}/${tgzFile}"

    // Upload tarball to GitHub release AFTER tag is pushed
    echo "Starting GitHub release upload for public repo..."
    uploadToGitHubRelease("${releaseDir}/${tgzFile}", currentVersion, "go-acoustic/react-native-acoustic-connect")
    echo "GitHub release upload completed for public repo"

    // Wait for GitHub Actions to publish to npm
    echo "Waiting for GitHub Actions to publish release to npm..."
    def publishResult = waitForGitHubActionsPublish(currentVersion, "go-acoustic/react-native-acoustic-connect")

    // Store results in global variables for Slack notification
    githubActionsUrl = publishResult.workflowUrl
    npmPublishStatus = publishResult.publishStatus
    npmPublishedVersion = publishResult.publishedVersion

    echo "GitHub Actions publish check completed for release"
    echo "Workflow URL: ${githubActionsUrl}"
    echo "Publish Status: ${npmPublishStatus}"
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
    def slackTitle = "Beta build"
    def npmUrl = "https://www.npmjs.com/package/react-native-acoustic-connect"
    if (isRelease) {
        releaseTitle = "********************Release********************\n"
        slackTitle = "Release build"
        npmUrl = "https://www.npmjs.com/package/react-native-acoustic-connect"
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
                        title: "${slackTitle}",
                        value: "${npmUrl}",
                        short: false
                    ],
                    [
                        title: "Version",
                        value: "${currentVersion}",
                        short: false
                    ],
                    [
                        title: "GitHub Actions Workflow",
                        value: "${githubActionsUrl}",
                        short: false
                    ],
                    [
                        title: "NPM Publish Status",
                        value: "${npmPublishStatus}",
                        short: true
                    ],
                    [
                        title: "Published Version",
                        value: "${npmPublishedVersion ?: 'N/A'}",
                        short: true
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
                        title: "${slackTitle}",
                        value: "${npmUrl}",
                        short: false
                    ],
                    [
                        title: "Version",
                        value: "${currentVersion}",
                        short: false
                    ],
                    [
                        title: "GitHub Actions Workflow",
                        value: "${githubActionsUrl}",
                        short: false
                    ],
                    [
                        title: "NPM Publish Status",
                        value: "${npmPublishStatus}",
                        short: true
                    ],
                    [
                        title: "Published Version",
                        value: "${npmPublishedVersion ?: 'N/A'}",
                        short: true
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


