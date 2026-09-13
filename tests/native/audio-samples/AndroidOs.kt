@file:Suppress("UNUSED_PARAMETER")

package android.os

/** Deterministic JVM scheduler; no Android device or microphone is involved. */
class Looper

object SystemClock {
  var now = 0L
  @JvmStatic fun elapsedRealtime(): Long = now
}

class Handler(looper: Looper) {
  private val callbacks = mutableListOf<Runnable>()
  init { instances.add(this) }
  fun post(callback: Runnable): Boolean { callbacks.add(callback); return true }
  fun removeCallbacksAndMessages(token: Any?) { callbacks.clear() }

  companion object {
    private val instances = mutableListOf<Handler>()
    fun queued(): Int = instances.sumOf { it.callbacks.size }
    fun drain() {
      instances.forEach { handler ->
        val callbacks = handler.callbacks.toList()
        handler.callbacks.clear()
        callbacks.forEach { it.run() }
      }
    }
  }
}
