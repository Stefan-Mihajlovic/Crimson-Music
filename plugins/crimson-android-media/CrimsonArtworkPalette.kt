package expo.modules.audio

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Small, bounded image decode off the main thread; no extra image or media service. */
internal object CrimsonArtworkPalette {
  private const val MAX_BYTES = 8 * 1024 * 1024
  private const val CACHE_LIMIT = 120
  private val colorPattern = Regex("#[0-9a-fA-F]{6}")

  @Synchronized
  fun extract(context: Context, source: String, cacheKey: String, allowNetwork: Boolean): List<String> {
    val directory = File(context.cacheDir, "crimson-artwork-palettes-v1").apply { mkdirs() }
    val hash = MessageDigest.getInstance("SHA-256").digest(cacheKey.toByteArray())
      .joinToString("") { "%02x".format(it.toInt() and 255) }
    val cache = File(directory, hash)
    if (cache.exists()) {
      val saved = runCatching { cache.readLines() }.getOrNull()
      if (saved?.size == 3 && saved.all { colorPattern.matches(it) }) {
        cache.setLastModified(System.currentTimeMillis())
        return saved
      }
    }
    val uri = Uri.parse(source)
    val bytes = when (uri.scheme) {
      "file" -> File(uri.path ?: return emptyList()).inputStream().use { readBounded(it) }
      "content" -> context.contentResolver.openInputStream(uri)?.use { readBounded(it) }
      "https" -> if (allowNetwork) download(source) else null
      else -> null
    } ?: return emptyList()

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || max(bounds.outWidth, bounds.outHeight) > 32768) return emptyList()
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > 96) sample *= 2
    val options = BitmapFactory.Options().apply { inSampleSize = sample }
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: return emptyList()
    val pixels = IntArray(bitmap.width * bitmap.height)
    bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
    bitmap.recycle()

    // Quantize hue, saturation and brightness, preserving several distinct cover colors.
    data class Bucket(var weight: Float = 0f, var red: Float = 0f, var green: Float = 0f, var blue: Float = 0f)
    val buckets = mutableMapOf<Int, Bucket>()
    val hsv = FloatArray(3)
    for (pixel in pixels) {
      if (Color.alpha(pixel) < 180) continue
      Color.colorToHSV(pixel, hsv)
      if (hsv[2] < 0.08f) continue
      val key = (hsv[0] / 20).toInt() * 100 + (hsv[1] * 4).toInt() * 10 + (hsv[2] * 4).toInt()
      val weight = 0.35f + hsv[1] * 1.4f
      val bucket = buckets.getOrPut(key) { Bucket() }
      bucket.weight += weight
      bucket.red += Color.red(pixel) * weight
      bucket.green += Color.green(pixel) * weight
      bucket.blue += Color.blue(pixel) * weight
    }
    val candidates = buckets.values.sortedByDescending { it.weight }.map {
      Color.rgb((it.red / it.weight).toInt(), (it.green / it.weight).toInt(), (it.blue / it.weight).toInt())
    }
    if (candidates.isEmpty()) return emptyList()
    val selected = mutableListOf(candidates.first())
    for (candidate in candidates.drop(1)) {
      if (selected.all { distance(candidate, it) > 75 }) selected.add(candidate)
      if (selected.size == 3) break
    }
    while (selected.size < 3) {
      Color.colorToHSV(selected.first(), hsv)
      hsv[2] = (hsv[2] * if (selected.size == 1) 0.7f else 1.12f).coerceIn(0.16f, 0.85f)
      selected.add(Color.HSVToColor(hsv))
    }
    val result = selected.map { color ->
      Color.colorToHSV(color, hsv)
      // Leave sufficient contrast for the player's white controls while retaining hue.
      hsv[2] = min(hsv[2], 0.78f)
      String.format(Locale.ROOT, "#%06x", Color.HSVToColor(hsv) and 0xffffff)
    }
    runCatching {
      cache.writeText(result.joinToString("\n"))
      directory.listFiles()?.sortedByDescending { it.lastModified() }?.drop(CACHE_LIMIT)?.forEach { it.delete() }
    }
    return result
  }

  private fun distance(a: Int, b: Int) = abs(Color.red(a) - Color.red(b)) + abs(Color.green(a) - Color.green(b)) + abs(Color.blue(a) - Color.blue(b))

  private fun readBounded(input: InputStream): ByteArray? {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (true) {
      val count = input.read(buffer)
      if (count < 0) break
      if (output.size() + count > MAX_BYTES) return null
      output.write(buffer, 0, count)
    }
    return output.toByteArray()
  }

  private fun download(source: String): ByteArray? {
    val connection = URL(source).openConnection() as HttpURLConnection
    connection.connectTimeout = 8000
    connection.readTimeout = 8000
    // Do not silently follow a redirect into an insecure/local endpoint.
    connection.instanceFollowRedirects = false
    return try {
      if (connection.responseCode !in 200..299 || connection.contentLengthLong > MAX_BYTES) null
      else connection.inputStream.use { readBounded(it) }
    } finally { connection.disconnect() }
  }
}
