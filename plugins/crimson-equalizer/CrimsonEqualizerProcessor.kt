package expo.modules.audio

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import kotlin.math.*

/** Permanently installed before the spectrum tee; settings never rebuild AudioSink. */
@UnstableApi
class CrimsonEqualizerProcessor : BaseAudioProcessor() {
  private data class Settings(val enabled: Boolean, val bands: DoubleArray, val preamp: Double)
  @Volatile private var requested = Settings(false, DoubleArray(5), 0.0)
  private var applied: Settings? = null
  private var dsp = CrimsonEqualizerDSP(48000.0, 2)
  private var frameSamples = DoubleArray(2)

  fun configureEqualizer(enabled: Boolean, bands: List<Double>, preampDb: Double) {
    requested = Settings(enabled, DoubleArray(5) { bands.getOrNull(it)?.takeIf(Double::isFinite)?.coerceIn(-12.0, 12.0) ?: 0.0 }, preampDb.takeIf(Double::isFinite)?.coerceIn(-72.0, 0.0) ?: 0.0)
  }

  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    // Returning the input format keeps the processor active even when EQ is off.
    return inputAudioFormat
  }

  override fun onFlush(streamMetadata: AudioProcessor.StreamMetadata) {
    dsp = CrimsonEqualizerDSP(inputAudioFormat.sampleRate.toDouble(), inputAudioFormat.channelCount)
    frameSamples = DoubleArray(inputAudioFormat.channelCount)
    applied = null
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    val settings = requested
    if (applied !== settings) {
      dsp.configure(settings.enabled, settings.bands, settings.preamp)
      applied = settings
    }
    val output = replaceOutputBuffer(inputBuffer.remaining())
    if (dsp.bypassed) {
      output.put(inputBuffer)
    } else {
      val channels = inputAudioFormat.channelCount
      while (inputBuffer.remaining() >= channels * 2) {
        dsp.frame()
        for (channel in 0 until channels) {
          val sample = inputBuffer.short.toDouble() / 32768.0
          frameSamples[channel] = dsp.sample(sample, channel)
        }
        dsp.limitFrame(frameSamples)
        for (channel in 0 until channels) output.putShort((frameSamples[channel] * 32768.0).roundToInt().coerceIn(-32768, 32767).toShort())
      }
      // AudioSink supplies whole frames. Preserve any trailing bytes defensively.
      output.put(inputBuffer)
    }
    output.flip()
  }
}

/** Pure DSP, independently tested with generated PCM tones; same coefficients as iOS/Web Audio. */
class CrimsonEqualizerDSP(private val sampleRate: Double, private val channels: Int) {
  private companion object {
    val FREQUENCIES = doubleArrayOf(100.0, 300.0, 1000.0, 4000.0, 10000.0)
  }
  private val coefficients = Array(5) { DoubleArray(5) }
  private val targets = Array(5) { DoubleArray(5) }
  private val increments = Array(5) { DoubleArray(5) }
  private val memory = Array(channels) { Array(5) { DoubleArray(2) } }
  private var gain = 1.0
  private var targetGain = 1.0
  private var gainIncrement = 0.0
  private var remaining = 0
  private var initialized = false
  private var disabled = true
  private var limiterGain = 1.0
  private var limiterHold = 0
  private val limiterHoldFrames = ceil(sampleRate * 0.030).toInt()
  private val limiterRelease = exp(-1.0 / (sampleRate * 0.150))
  val bypassed: Boolean get() = disabled && remaining == 0

  fun configure(enabled: Boolean, bands: DoubleArray, preampDb: Double) {
    val active = enabled && bands.any { it.isFinite() && abs(it) > 0.000001 }
    disabled = !active
    val frames = max(1, ceil(sampleRate * 0.025).toInt())
    targetGain = if (active) 10.0.pow(preampDb.coerceIn(-72.0, 0.0) / 20.0) else 1.0
    for (band in 0 until 5) {
      val omega = 2.0 * PI * min(FREQUENCIES[band], sampleRate * 0.45) / sampleRate
      val amplitude = 10.0.pow((if (active) bands[band].coerceIn(-12.0, 12.0) else 0.0) / 40.0)
      val alpha = sin(omega) / sqrt(2.0)
      val cosine = cos(omega)
      val a0: Double
      if (band == 0) {
        val rootAlpha = 2.0 * sqrt(amplitude) * alpha
        a0 = (amplitude + 1.0) + (amplitude - 1.0) * cosine + rootAlpha
        targets[band][0] = amplitude * ((amplitude + 1.0) - (amplitude - 1.0) * cosine + rootAlpha)
        targets[band][1] = 2.0 * amplitude * ((amplitude - 1.0) - (amplitude + 1.0) * cosine)
        targets[band][2] = amplitude * ((amplitude + 1.0) - (amplitude - 1.0) * cosine - rootAlpha)
        targets[band][3] = -2.0 * ((amplitude - 1.0) + (amplitude + 1.0) * cosine)
        targets[band][4] = (amplitude + 1.0) + (amplitude - 1.0) * cosine - rootAlpha
      } else if (band == 4) {
        val rootAlpha = 2.0 * sqrt(amplitude) * alpha
        a0 = (amplitude + 1.0) - (amplitude - 1.0) * cosine + rootAlpha
        targets[band][0] = amplitude * ((amplitude + 1.0) + (amplitude - 1.0) * cosine + rootAlpha)
        targets[band][1] = -2.0 * amplitude * ((amplitude - 1.0) + (amplitude + 1.0) * cosine)
        targets[band][2] = amplitude * ((amplitude + 1.0) + (amplitude - 1.0) * cosine - rootAlpha)
        targets[band][3] = 2.0 * ((amplitude - 1.0) - (amplitude + 1.0) * cosine)
        targets[band][4] = (amplitude + 1.0) - (amplitude - 1.0) * cosine - rootAlpha
      } else {
        a0 = 1.0 + alpha / amplitude
        targets[band][0] = 1.0 + alpha * amplitude
        targets[band][1] = -2.0 * cosine
        targets[band][2] = 1.0 - alpha * amplitude
        targets[band][3] = targets[band][1]
        targets[band][4] = 1.0 - alpha / amplitude
      }
      for (c in 0 until 5) {
        targets[band][c] /= a0
        if (!initialized) coefficients[band][c] = targets[band][c]
        increments[band][c] = (targets[band][c] - coefficients[band][c]) / frames
      }
    }
    if (!initialized) gain = targetGain
    gainIncrement = (targetGain - gain) / frames
    remaining = if (initialized) frames else 0
    initialized = true
  }

  fun frame() {
    if (remaining == 0) return
    remaining--
    gain = if (remaining == 0) targetGain else gain + gainIncrement
    for (band in 0 until 5) for (c in 0 until 5) coefficients[band][c] = if (remaining == 0) targets[band][c] else coefficients[band][c] + increments[band][c]
    if (remaining == 0 && disabled) {
      memory.forEach { bands -> bands.forEach { it.fill(0.0) } }
      limiterGain = 1.0
      limiterHold = 0
    }
  }

  fun sample(input: Double, channel: Int): Double {
    if (!initialized || bypassed || channel !in 0 until channels) return input
    var value = if (input.isFinite()) input * gain else 0.0
    for (band in 0 until 5) {
      val c = coefficients[band]
      val state = memory[channel][band]
      val result = c[0] * value + state[0]
      state[0] = c[1] * value - c[3] * result + state[1]
      state[1] = c[2] * value - c[4] * result
      value = result
    }
    return value
  }

  /** Complete a whole channel frame before measuring its linked peak. */
  fun limitFrame(samples: DoubleArray) {
    if (!initialized || bypassed) return
    var peak = 0.0
    for (channel in samples.indices) {
      if (!samples[channel].isFinite()) samples[channel] = 0.0
      peak = max(peak, abs(samples[channel]))
    }
    val required = if (peak > 0.98) 0.98 / peak else 1.0
    if (disabled) {
      limiterGain = min(required, limiterGain + (1.0 - limiterGain) / (remaining + 1))
      limiterHold = 0
    } else if (required <= limiterGain + 0.000001) {
      limiterGain = min(limiterGain, required)
      limiterHold = limiterHoldFrames
    } else if (limiterHold > 0) {
      limiterHold--
    } else {
      limiterGain = min(required, 1.0 + (limiterGain - 1.0) * limiterRelease)
    }
    for (channel in samples.indices) samples[channel] *= limiterGain
  }
}
