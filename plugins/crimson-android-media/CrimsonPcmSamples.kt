package expo.modules.audio

import java.nio.ByteBuffer

/** The default Media3 integer pipeline converts PCM to signed 16-bit little endian first. */
internal object CrimsonPcmSamples {
  const val MAX_FRAMES = 512
  const val MAX_CHANNELS = 2

  fun read(buffer: ByteBuffer, channelCount: Int): List<FloatArray> {
    if (channelCount !in 1..32) return emptyList()
    val bytesPerFrame = channelCount * 2
    val frameCount = (buffer.remaining() / bytesPerFrame).coerceAtMost(MAX_FRAMES)
    if (frameCount == 0) return emptyList()
    val channels = List(channelCount.coerceAtMost(MAX_CHANNELS)) { FloatArray(frameCount) }
    val start = buffer.position()
    for (frame in 0 until frameCount) {
      for (channel in channels.indices) {
        val index = start + frame * bytesPerFrame + channel * 2
        val bits = (buffer.get(index).toInt() and 0xff) or (buffer.get(index + 1).toInt() shl 8)
        channels[channel][frame] = bits.toShort().toFloat() / 32768f
      }
    }
    // Absolute reads preserve the source buffer's position, limit, order and audio bytes.
    return channels
  }
}
