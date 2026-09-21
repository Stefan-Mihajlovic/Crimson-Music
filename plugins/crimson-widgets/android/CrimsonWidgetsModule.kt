package __PACKAGE__.widgets

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject

class CrimsonWidgetsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val artworkExecutor = Executors.newSingleThreadExecutor()
  private val revision = AtomicInteger()
  private var artworkSource: String? = null
  override fun getName() = "CrimsonWidgets"

  @ReactMethod
  fun updateSnapshot(json: String, promise: Promise) {
    try {
      require(json.length < 32768) { "Widget snapshot is too large" }
      val snapshot = JSONObject(json)
      val preferences = context.getSharedPreferences("crimson_widgets", 0)
      val source = snapshot.optString("artworkUrl")
      preferences.edit().putString("snapshot", json).apply()
      if (source != artworkSource) {
        artworkSource = source
        val request = revision.incrementAndGet()
        preferences.edit().remove("artworkSource").apply()
        File(context.filesDir, "crimson-widget-artwork.jpg").delete()
        if (source.isNotEmpty()) artworkExecutor.execute {
          try {
            val uri = Uri.parse(source)
            val bytes = when (uri.scheme) {
              "https", "http" -> {
                val connection = URL(source).openConnection() as HttpURLConnection
                connection.connectTimeout = 12000
                connection.readTimeout = 12000
                try {
                  if (connection.responseCode !in 200..299) null
                  else connection.inputStream.use { it.readBytesLimited(8_000_000) }
                } finally { connection.disconnect() }
              }
              "file", "content" -> context.contentResolver.openInputStream(uri)?.use { it.readBytesLimited(8_000_000) }
              else -> null
            }
            if (bytes != null && request == revision.get()) {
              val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
              BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
              val options = BitmapFactory.Options().apply {
                inSampleSize = (maxOf(bounds.outWidth, bounds.outHeight) / 384).coerceAtLeast(1)
              }
              BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.let { bitmap ->
                val temporary = File(context.filesDir, "crimson-widget-artwork.tmp")
                temporary.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 85, it) }
                bitmap.recycle()
                if (request == revision.get()) {
                  temporary.renameTo(File(context.filesDir, "crimson-widget-artwork.jpg"))
                  preferences.edit().putString("artworkSource", source).apply()
                  CrimsonWidgetProvider.refreshAll(context)
                } else temporary.delete()
              }
            }
          } catch (_: Exception) { /* Text and controls still work without artwork. */ }
        }
      }
      CrimsonWidgetProvider.refreshAll(context)
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("widget_snapshot", error) }
  }

  override fun invalidate() {
    revision.incrementAndGet()
    artworkExecutor.shutdownNow()
    super.invalidate()
  }
}

private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
  val output = java.io.ByteArrayOutputStream()
  val buffer = ByteArray(8192)
  while (true) {
    val count = read(buffer)
    if (count < 0) break
    require(output.size() + count <= limit) { "Artwork exceeds widget limit" }
    output.write(buffer, 0, count)
  }
  return output.toByteArray()
}
