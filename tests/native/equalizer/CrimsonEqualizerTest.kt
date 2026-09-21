package expo.modules.audio

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.*

fun main() {
  val frequencies = doubleArrayOf(100.0, 300.0, 1000.0, 4000.0, 10000.0)
  for (rate in listOf(22050, 48000)) for (band in 0 until 5) for (gain in -12..12 step 6) {
    if (gain == 0) continue
    val dsp = CrimsonEqualizerDSP(rate.toDouble(), 2)
    val gains = DoubleArray(5); gains[band] = gain.toDouble()
    dsp.configure(true, gains, -3.0)
    var inputPower = 0.0; var outputPower = 0.0
    val samples = DoubleArray(2)
    val frequency = min(frequencies[band], rate * 0.45)
    for (frame in 0 until rate) {
      val input = 0.01 * sin(2 * PI * frequency * frame / rate)
      dsp.frame()
      samples[0] = dsp.sample(input, 0); samples[1] = dsp.sample(0.0, 1)
      dsp.limitFrame(samples)
      val output = samples[0]
      check(samples[1] == 0.0) { "stereo channel leakage" }
      if (frame > rate / 2) { inputPower += input * input; outputPower += output * output }
    }
    val expected = (if (band == 0 || band == 4) gain / 2.0 else gain.toDouble()) - 3
    check(abs(10 * log10(outputPower / inputPower) - expected) < 0.01) { "wrong tone response: $rate Hz band $band gain $gain" }
  }
  val limiter = CrimsonEqualizerDSP(48000.0, 2)
  limiter.configure(true, doubleArrayOf(7.0, 3.0, -1.0, 0.0, 0.0), -1.4)
  val impulse = doubleArrayOf(2.0, -0.5)
  limiter.limitFrame(impulse)
  check(abs(impulse[0] - 0.98) < 1e-12 && abs(impulse[1] + 0.245) < 1e-12)
  val quiet = DoubleArray(2)
  repeat(1440) {
    quiet[0] = 0.2; quiet[1] = -0.1; limiter.limitFrame(quiet)
    check(abs(quiet[0] - 0.098) < 1e-12) { "30ms hold changed" }
  }
  repeat(7200) { quiet[0] = 0.2; quiet[1] = -0.1; limiter.limitFrame(quiet) }
  check(abs(quiet[0] / 0.2 - (1 - 0.51 / exp(1.0))) < 1e-10) { "150ms exponential release changed" }
  val processor = CrimsonEqualizerProcessor()
  val format = AudioProcessor.AudioFormat(48000, 2, C.ENCODING_PCM_16BIT)
  check(processor.configure(format) == format)
  processor.flush(AudioProcessor.StreamMetadata.DEFAULT)
  check(processor.isActive) { "disabled DSP must remain attached" }
  val input = ByteBuffer.allocateDirect(4096).order(ByteOrder.nativeOrder())
  repeat(2048) { input.putShort((it * 31 - 30000).toShort()) }; input.flip()
  val expected = ByteArray(input.remaining()); input.duplicate().get(expected)
  processor.queueInput(input)
  val output = processor.output
  val actual = ByteArray(output.remaining()); output.get(actual)
  check(expected.contentEquals(actual)) { "disabled PCM changed" }
  processor.configureEqualizer(true, listOf(12.0, 12.0, 12.0, 12.0, 12.0), 0.0)
  input.clear(); repeat(2048) { input.putShort(Short.MAX_VALUE) }; input.flip()
  processor.queueInput(input)
  val enabledOutput = processor.output
  check(enabledOutput.remaining() == 4096)
  processor.flush(AudioProcessor.StreamMetadata.DEFAULT) // a seek/source reset retains the configured preset
  val tone = ByteBuffer.allocateDirect(48000 * 4).order(ByteOrder.nativeOrder())
  repeat(48000) { tone.putShort((1000 * sin(2 * PI * 1000 * it / 48000)).toInt().toShort()); tone.putShort(0) }; tone.flip()
  processor.queueInput(tone)
  val filtered = processor.output
  var loudest = 0
  while (filtered.hasRemaining()) { loudest = max(loudest, abs(filtered.short.toInt())); check(filtered.short == 0.toShort()) }
  check(loudest > 3900) { "settings lost after source flush or no PCM effect" }
  processor.configureEqualizer(true, listOf(7.0, 3.0, -1.0, 0.0, 0.0), -1.4)
  processor.flush(AudioProcessor.StreamMetadata.DEFAULT)
  val loudTone = ByteBuffer.allocateDirect(96000 * 4).order(ByteOrder.nativeOrder())
  repeat(96000) {
    val sample = (0.95 * 32768 * sin(2 * PI * 40 * it / 48000)).roundToInt()
    loudTone.putShort(sample.toShort()); loudTone.putShort((-sample / 2).toShort())
  }; loudTone.flip()
  processor.queueInput(loudTone)
  val limited = processor.output
  var peak = 0; var plateau = 0; var frame = 0
  while (limited.hasRemaining()) {
    val left = limited.short.toInt(); val right = limited.short.toInt()
    check(abs(right + left * 0.5) < 4) { "independent channel clipping changed stereo balance" }
    check(abs(left) <= 32113 && abs(right) <= 32113) { "PCM exceeded limiter ceiling" }
    if (frame++ > 24000) { peak = max(peak, abs(left)); if (abs(left) >= 32112) plateau++ }
  }
  check(peak >= 32100 && plateau < 1800) { "bass clipping plateau or unnecessary attenuation: $peak/$plateau" }
  println("PASS Android linked40Hz PCM: peak=$peak/32768, ceilingSamples=$plateau, stereo ratio preserved")

  // Switching to Flat while the limiter is holding recovers within the 25ms transition.
  processor.configureEqualizer(true, listOf(0.0, 0.0, 0.0, 0.0, 0.0), -2.0)
  val flatInput = ByteBuffer.allocateDirect(32768 * 4).order(ByteOrder.nativeOrder())
  repeat(32768) { flatInput.putShort((it * 2 - 32768).toShort()); flatInput.putShort((32767 - it * 2).toShort()) }; flatInput.flip()
  processor.queueInput(flatInput)
  val flatOutput = processor.output
  repeat(32768) {
    val left = flatOutput.short; val right = flatOutput.short
    if (it >= 1200) check(left == (it * 2 - 32768).toShort() && right == (32767 - it * 2).toShort()) { "Flat changed a PCM sample after transition" }
  }
  println("PASS Android shelves/peaking tones, multiple rates, linked attack/hold/release, permanent processor, exact off/Flat PCM, source persistence")
}
