package com.awesomeprojectwithoutframework_0_76_9
import com.acoustic.connect.android.connectmod.Connect
import android.view.MotionEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
    override fun getMainComponentName(): String = "AwesomeProjectWithoutFramework_0_76_9"

    /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
    override fun createReactActivityDelegate(): ReactActivityDelegate = DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun dispatchTouchEvent(e: MotionEvent?): Boolean {
        Connect.dispatchTouchEvent(this, e)
        return super.dispatchTouchEvent(e)
    }
}

