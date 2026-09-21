  // Crimson native sleep timer: deadlines remain armed while JavaScript is suspended.
  private let crimsonSleepLock = NSRecursiveLock()
  private var crimsonSleepDeadlineAt: Double = 0
  private var crimsonSleepExpiredAt: Double = 0
  private var crimsonSleepGeneration: UInt64 = 0
  private var crimsonSleepWork: DispatchWorkItem?

  var crimsonSleepTimerExpiredAt: Double {
    crimsonSleepLock.lock()
    defer { crimsonSleepLock.unlock() }
    return crimsonSleepExpiredAt
  }

  func setCrimsonSleepTimer(_ deadlineAt: Double) {
    crimsonSleepLock.lock()
    crimsonSleepWork?.cancel()
    crimsonSleepWork = nil
    crimsonSleepGeneration &+= 1
    crimsonSleepExpiredAt = 0
    crimsonSleepDeadlineAt = deadlineAt.isFinite && deadlineAt > 0 ? deadlineAt : 0
    let generation = crimsonSleepGeneration
    let delay = (crimsonSleepDeadlineAt - Date().timeIntervalSince1970 * 1000) / 1000
    if crimsonSleepDeadlineAt > 0 {
      let work = DispatchWorkItem { [weak self] in self?.crimsonSleepDeadlineReached(generation) }
      crimsonSleepWork = work
      DispatchQueue.main.asyncAfter(wallDeadline: .now() + max(0, delay), execute: work)
    }
    crimsonSleepLock.unlock()
  }

  private func crimsonSleepDeadlineReached(_ generation: UInt64) {
    crimsonSleepLock.lock()
    guard generation == crimsonSleepGeneration, crimsonSleepDeadlineAt > 0, crimsonSleepExpiredAt == 0 else {
      crimsonSleepLock.unlock()
      return
    }
    let deadline = crimsonSleepDeadlineAt
    if Date().timeIntervalSince1970 * 1000 < deadline {
      setCrimsonSleepTimer(deadline)
      crimsonSleepLock.unlock()
      return
    }
    crimsonSleepWork = nil
    crimsonSleepExpiredAt = deadline
    // Serialize the pause with cancellation/replacement, so an old timer cannot
    // pause a newly armed session after releasing this lock.
    ref.pause()
    wasPlaying = false
    updateStatus(with: ["playing": false, "crimsonSleepTimerExpiredAt": deadline])
    crimsonSleepLock.unlock()
  }

  func crimsonSleepTimerBlocksPlayback() -> Bool {
    crimsonSleepLock.lock()
    defer { crimsonSleepLock.unlock() }
    if crimsonSleepExpiredAt > 0 { return true }
    if crimsonSleepDeadlineAt > 0 && Date().timeIntervalSince1970 * 1000 >= crimsonSleepDeadlineAt {
      crimsonSleepDeadlineReached(crimsonSleepGeneration)
      return true
    }
    return false
  }
