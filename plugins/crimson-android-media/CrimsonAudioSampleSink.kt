package expo.modules.audio

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.audio.TeeAudioProcessor
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** Observes this player's decoded output; never uses a microphone or a second player. */
@UnstableApi
class CrimsonAudioSampleSink(looper: Looper) : TeeAudioProcessor.AudioBufferSink {
  private val handler = Handler(looper)
  private val generation = AtomicInteger(0)
  private val pending = AtomicReference<Any?>(null)
  @Volatile private var enabled = false
  @Volatile private var released = false
  private var channelCount = 0
  private var encoding = C.ENCODING_INVALID
  private var lastCaptureMs = Long.MIN_VALUE

  // Assigned and invoked on the player's main looper only.
  var onSample: ((List<FloatArray>) -> Unit)? = null

  fun renderersFactory(context: Context): DefaultRenderersFactory =
    object : DefaultRenderersFactory(context) {
      override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioOutputPlaybackParams: Boolean
      ): AudioSink = DefaultAudioSink.Builder(context)
        .setEnableFloatOutput(enableFloatOutput)
        .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParams)
        .setAudioProcessors(arrayOf(TeeAudioProcessor(this@CrimsonAudioSampleSink)))
        .build()
    }

  fun setEnabled(value: Boolean) {
    enabled = value && !released
    if (!enabled) cancelPending()
  }

  override fun flush(sampleRateHz: Int, channelCount: Int, encoding: Int) {
    this.channelCount = channelCount
    this.encoding = encoding
    lastCaptureMs = Long.MIN_VALUE
    cancelPending()
  }

  override fun handleBuffer(buffer: ByteBuffer) {
    if (!enabled || released || encoding != C.ENCODING_PCM_16BIT) return
    val now = SystemClock.elapsedRealtime()
    if (lastCaptureMs != Long.MIN_VALUE && now - lastCaptureMs < SAMPLE_INTERVAL_MS) return
    val sampleGeneration = generation.get()
    val ticket = Any()
    // Keep at most one queued packet even if the JS/UI thread is busy.
    if (!pending.compareAndSet(null, ticket)) return
    val channels = CrimsonPcmSamples.read(buffer, channelCount)
    if (channels.isEmpty()) {
      pending.compareAndSet(ticket, null)
      return
    }
    lastCaptureMs = now
    handler.post {
      if (pending.compareAndSet(ticket, null) && enabled && !released && generation.get() == sampleGeneration) {
        onSample?.invoke(channels)
      }
    }
  }

  fun release() {
    released = true
    enabled = false
    onSample = null
    cancelPending()
  }

  private fun cancelPending() {
    generation.incrementAndGet()
    pending.set(null)
    handler.removeCallbacksAndMessages(null)
  }

  companion object {
    private const val SAMPLE_INTERVAL_MS = 50L
  }
}
