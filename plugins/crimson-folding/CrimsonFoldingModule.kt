package com.crimson.folding

import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

/** Activity-scoped collection; never keep a WindowLayoutInfo flow across recreation. */
class CrimsonFoldingModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private var job: Job? = null
  private var listeners = 0
  init { context.addLifecycleEventListener(this) }
  override fun getName() = "CrimsonFolding"
  @ReactMethod fun addListener(name: String) { listeners++; start() }
  @ReactMethod fun removeListeners(count: Int) { listeners = (listeners - count).coerceAtLeast(0); if (listeners == 0) stop() }
  private fun start() { scope.launch {
    if (listeners == 0 || job != null) return@launch
    val activity = context.currentActivity ?: return@launch
    job = scope.launch {
      WindowInfoTracker.getOrCreate(activity).windowLayoutInfo(activity).collect { info ->
        val feature = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull {
          it.isSeparating || it.state == FoldingFeature.State.HALF_OPENED
        }
        val payload = Arguments.createMap()
        if (feature != null) {
          val density = activity.resources.displayMetrics.density
          val bounds = feature.bounds
          payload.putString("orientation", if (feature.orientation == FoldingFeature.Orientation.HORIZONTAL) "horizontal" else "vertical")
          payload.putDouble("x", bounds.left / density.toDouble())
          payload.putDouble("y", bounds.top / density.toDouble())
          payload.putDouble("width", bounds.width() / density.toDouble())
          payload.putDouble("height", bounds.height() / density.toDouble())
        }
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("crimsonFoldingChanged", payload)
      }
    }
  } }
  private fun stop() { job?.cancel(); job = null }
  override fun onHostResume() = start()
  override fun onHostPause() { stop() }
  override fun onHostDestroy() { stop() }
  override fun invalidate() { stop(); scope.cancel(); context.removeLifecycleEventListener(this); super.invalidate() }
}
