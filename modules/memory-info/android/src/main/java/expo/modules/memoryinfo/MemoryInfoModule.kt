package expo.modules.memoryinfo

import android.app.ActivityManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.os.Debug
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MemoryInfoModule : Module() {
  private var trimCallbacks: ComponentCallbacks2? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("MemoryInfo")

    Events("onMemoryPressure")

    // Async so measuring (a few ms) never blocks the JS thread.
    AsyncFunction("getMemoryAsync") {
      // PSS = this app's share of physical RAM: Java heap + native (llama/whisper) +
      // touched pages of mmapped model files. Same number Android shows in Settings.
      val appInfo = Debug.MemoryInfo().also { Debug.getMemoryInfo(it) }
      val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val system = ActivityManager.MemoryInfo().also { activityManager.getMemoryInfo(it) }

      mapOf(
        "appUsedBytes" to appInfo.totalPss.toLong() * 1024,
        "availableBytes" to system.availMem,
        "totalBytes" to system.totalMem,
        "lowMemory" to system.lowMemory,
      )
    }

    // React Native doesn't forward Android's memory warnings to JS (AppState's
    // `memoryWarning` is iOS-only), so we listen for them here and emit an event.
    OnCreate {
      val callbacks = object : ComponentCallbacks2 {
        override fun onTrimMemory(level: Int) {
          val critical = level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL ||
            level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND
          val runningLow = level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW
          if (critical || runningLow) {
            sendEvent("onMemoryPressure", mapOf("level" to level, "critical" to critical))
          }
        }

        override fun onLowMemory() {
          sendEvent("onMemoryPressure", mapOf("level" to ComponentCallbacks2.TRIM_MEMORY_COMPLETE, "critical" to true))
        }

        override fun onConfigurationChanged(newConfig: Configuration) = Unit
      }
      context.applicationContext.registerComponentCallbacks(callbacks)
      trimCallbacks = callbacks
    }

    OnDestroy {
      trimCallbacks?.let { appContext.reactContext?.applicationContext?.unregisterComponentCallbacks(it) }
      trimCallbacks = null
    }
  }
}
