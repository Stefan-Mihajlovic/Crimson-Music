# Sleep timer

Crimson offers 5, 15, 30, 45, 60, and 90 minutes, plus **End of current song**. A duration keeps counting while playback is paused and when songs change. The song option belongs to the current playback activation: manually choosing another song cancels it. At its natural end, Crimson pauses instead of repeating, crossfading, or advancing the queue. Canceling a timer leaves playback alone.

The controller stores an absolute deadline and publishes only configuration or expiration changes. The open sheet renders its own countdown. Timers belong to the current player session and are not restored after the app process is killed.

On iOS and Android, the native adapter arms both Expo Audio decks. Native code pauses them at the deadline independently of JavaScript, records the expired deadline, and blocks delayed playback until the timer is cleared. Provider reconciliation updates the visible playback state after background suspension. The adapter is pinned to Expo Audio 57.0.5 and must be reapplied and rebuilt after native dependency changes.

The browser schedules a separate Web Audio gain cutoff when its audio graph is available; the controller also pauses the media element at expiration. This keeps timer gain separate from equalizer and crossfade gain. Browsers still control audio suspension and background execution.

Regression coverage checks deadlines, replacement/cancellation, stale native events, track identity, stable snapshots, sheet layout/countdown, both-deck enforcement, and native adapter installation. A macOS test compiles and executes the actual Swift timer implementation against a pause sink without JavaScript. Native app builds and device playback checks validate integration separately.
