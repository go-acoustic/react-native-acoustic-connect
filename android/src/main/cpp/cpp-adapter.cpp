#include <jni.h>
#include "AcousticConnectRNOnLoad.hpp"
#include <fbjni/fbjni.h>

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::acousticconnectrn::registerAllNatives();
  });
}
