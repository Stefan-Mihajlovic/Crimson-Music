  // Crimson native sleep timer: uses the same looper as the actual audio player.
  private val crimsonSleepHandler = android.os.Handler(android.os.Looper.getMainLooper())
  private var crimsonSleepDeadlineAt = 0.0
  @Volatile var crimsonSleepTimerExpiredAt = 0.0
    private set
  private var crimsonSleepGeneration = 0L
  private var crimsonSleepWork: Runnable? = null
  private val crimsonSleepListener = object : Player.Listener {
    override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
      if (playWhenReady && crimsonSleepTimerBlocksPlayback()) ref.pause()
    }
  }

  fun setCrimsonSleepTimer(deadlineAt: Double) {
    crimsonSleepWork?.let { crimsonSleepHandler.removeCallbacks(it) }
    crimsonSleepWork = null
    crimsonSleepGeneration += 1
    crimsonSleepTimerExpiredAt = 0.0
    crimsonSleepDeadlineAt = if (deadlineAt.isFinite() && deadlineAt > 0) deadlineAt else 0.0
    if (crimsonSleepDeadlineAt <= 0) return
    val generation = crimsonSleepGeneration
    val work = Runnable { crimsonSleepDeadlineReached(generation) }
    crimsonSleepWork = work
    crimsonSleepHandler.postDelayed(work, (crimsonSleepDeadlineAt - System.currentTimeMillis()).toLong().coerceAtLeast(0))
  }

  private fun crimsonSleepDeadlineReached(generation: Long) {
    if (generation != crimsonSleepGeneration || crimsonSleepDeadlineAt <= 0 || crimsonSleepTimerExpiredAt > 0) return
    if (System.currentTimeMillis() < crimsonSleepDeadlineAt) {
      setCrimsonSleepTimer(crimsonSleepDeadlineAt)
      return
    }
    crimsonSleepWork = null
    crimsonSleepTimerExpiredAt = crimsonSleepDeadlineAt
    intendedPlayingState = false
    ref.pause()
    sendStatusUpdate(mapOf("playing" to false, "crimsonSleepTimerExpiredAt" to crimsonSleepTimerExpiredAt))
  }

  fun crimsonSleepTimerBlocksPlayback(): Boolean {
    if (crimsonSleepTimerExpiredAt > 0) return true
    if (crimsonSleepDeadlineAt > 0 && System.currentTimeMillis() >= crimsonSleepDeadlineAt) {
      crimsonSleepDeadlineReached(crimsonSleepGeneration)
      return true
    }
    return false
  }
