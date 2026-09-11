package expo.modules.audio

import android.os.Handler
import android.os.Looper

/** Queue actions for Expo's existing player/session; this object never creates a player. */
internal object CrimsonRemoteCommands {
  const val ACTION_PREVIOUS = "crimson.remote.previous"
  const val ACTION_NEXT = "crimson.remote.next"
  const val ACTION_LIKE = "crimson.remote.like"

  data class State(
    val active: Boolean = false,
    val canGoNext: Boolean = false,
    val canGoPrevious: Boolean = false,
    val liked: Boolean = false
  )

  private val main = Handler(Looper.getMainLooper())
  private val listeners = mutableSetOf<() -> Unit>()
  @Volatile var state = State()
    private set
  @Volatile var emit: ((String) -> Unit)? = null

  fun configure(active: Boolean, canGoNext: Boolean, canGoPrevious: Boolean, liked: Boolean) {
    main.post {
      val next = State(active, active && canGoNext, active && canGoPrevious, liked)
      if (next != state) {
        state = next
        listeners.toList().forEach { it() }
      }
    }
  }

  fun addListener(listener: () -> Unit) { listeners.add(listener) }
  fun removeListener(listener: () -> Unit) { listeners.remove(listener) }

  fun dispatch(action: String) {
    main.post {
      val current = state
      val event = when {
        action == ACTION_NEXT && current.canGoNext -> "crimsonRemoteNext"
        action == ACTION_PREVIOUS && current.canGoPrevious -> "crimsonRemotePrevious"
        action == ACTION_LIKE && current.active -> "crimsonRemoteLike"
        else -> null
      }
      event?.let { emit?.invoke(it) }
    }
  }

  fun disconnect() {
    emit = null
    configure(false, false, false, false)
  }
}
