package expo.modules.audio

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.C
import java.nio.ByteBuffer
import java.nio.ByteOrder

private var checks = 0
private fun verify(name: String, condition: Boolean) {
  check(condition) { name }
  checks += 1
  println("PASS $name")
}

private fun pcm(vararg samples: Int): ByteBuffer =
  ByteBuffer.allocate(samples.size * 2).order(ByteOrder.LITTLE_ENDIAN).apply {
    samples.forEach { putShort(it.toShort()) }
    flip()
  }

fun main() {
  val buffer = ByteBuffer.allocate(12).order(ByteOrder.LITTLE_ENDIAN).apply {
    putShort(1234)
    putShort(-32768); putShort(32767)
    putShort(0); putShort(-16384)
    putShort(4321)
    position(2); limit(10)
    order(ByteOrder.BIG_ENDIAN)
  }
  val original = buffer.array().copyOf()
  val readOnly = buffer.asReadOnlyBuffer().order(ByteOrder.BIG_ENDIAN)
  val decoded = CrimsonPcmSamples.read(readOnly, 2)
  verify("signed little-endian stereo decoding respects position and limit", decoded.size == 2 && decoded[0].contentEquals(floatArrayOf(-1f, 0f)) && decoded[1].contentEquals(floatArrayOf(32767f / 32768f, -0.5f)))
  verify("PCM reading leaves bytes, position, limit and byte order unchanged", buffer.array().contentEquals(original) && readOnly.position() == 2 && readOnly.limit() == 10 && readOnly.order() == ByteOrder.BIG_ENDIAN)
  val manyChannels = CrimsonPcmSamples.read(pcm(100, 200, 300, 400, 500, 600, 700, 800), 4)
  verify("multichannel capture keeps first two channels with original frame stride", manyChannels.size == 2 && manyChannels[0].contentEquals(floatArrayOf(100f / 32768f, 500f / 32768f)) && manyChannels[1].contentEquals(floatArrayOf(200f / 32768f, 600f / 32768f)))
  verify("capture has a hard 512-frame limit", CrimsonPcmSamples.read(ByteBuffer.allocate(4096), 2).all { it.size == 512 })
  verify("incomplete frames are ignored safely", CrimsonPcmSamples.read(ByteBuffer.allocate(3), 2).isEmpty())
  verify("invalid channel counts are ignored safely", CrimsonPcmSamples.read(buffer, 0).isEmpty() && CrimsonPcmSamples.read(buffer, Int.MAX_VALUE).isEmpty())

  val sink = CrimsonAudioSampleSink(Looper())
  val received = mutableListOf<List<FloatArray>>()
  sink.onSample = { received.add(it) }
  sink.flush(44100, 2, C.ENCODING_PCM_16BIT)
  sink.handleBuffer(pcm(100, 200))
  verify("disabled sampling posts no work", Handler.queued() == 0)
  sink.setEnabled(true)
  sink.handleBuffer(pcm(-32768, 32767))
  verify("callbacks wait for the main-looper dispatcher", received.isEmpty() && Handler.queued() == 1)
  SystemClock.now = 10
  sink.handleBuffer(pcm(1, 2))
  verify("a busy main thread retains at most one packet", Handler.queued() == 1)
  Handler.drain()
  verify("main-thread callback carries real decoded samples", received.single()[0][0] == -1f && received.single()[1][0] == 32767f / 32768f)
  SystemClock.now = 20
  sink.handleBuffer(pcm(1, 2))
  verify("packets within 50ms are throttled", Handler.queued() == 0)
  SystemClock.now = 50
  sink.handleBuffer(pcm(1, 2))
  Handler.drain()
  verify("a packet is available after 50ms", received.size == 2)
  SystemClock.now = 100
  sink.handleBuffer(pcm(1, 2))
  sink.setEnabled(false)
  sink.setEnabled(true)
  Handler.drain()
  verify("disable and immediate re-enable cancel the old queued packet", received.size == 2 && Handler.queued() == 0)
  SystemClock.now = 150
  sink.handleBuffer(pcm(1, 2))
  sink.flush(48000, 1, C.ENCODING_PCM_16BIT)
  Handler.drain()
  verify("source/format flush cancels old samples", received.size == 2)
  sink.handleBuffer(pcm(16384))
  Handler.drain()
  verify("sampling resumes with the new channel format", received.last().size == 1 && received.last()[0][0] == 0.5f)
  sink.flush(48000, 1, C.ENCODING_PCM_FLOAT)
  sink.handleBuffer(pcm(1, 2))
  verify("unsupported future PCM formats never produce misleading samples", Handler.queued() == 0)
  sink.flush(44100, 2, C.ENCODING_PCM_16BIT)
  sink.handleBuffer(pcm(1, 2))
  sink.release()
  sink.setEnabled(true)
  Handler.drain()
  sink.handleBuffer(pcm(1, 2))
  verify("release clears callbacks and permanently disables capture", received.size == 3 && Handler.queued() == 0 && sink.onSample == null)
  println("$checks native PCM checks passed")
}
