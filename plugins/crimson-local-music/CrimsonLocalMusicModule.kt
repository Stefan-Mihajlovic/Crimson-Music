package com.crimson.localmusic

import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import com.facebook.react.bridge.*
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

class CrimsonLocalMusicModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  private val directory get() = File(context.filesDir, "CrimsonLocalMusic").also { it.mkdirs() }
  private var picker: Promise? = null
  private val requestCode = 48301
  override fun getName() = "CrimsonLocalMusic"
  init {
    context.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, code: Int, result: Int, intent: Intent?) {
        if (code != requestCode) return
        val promise = picker ?: return
        picker = null
        if (result != Activity.RESULT_OK || intent == null) {
          promise.resolve(Arguments.makeNativeMap(mapOf("files" to emptyList<Any>(), "skipped" to 0))); return
        }
        val uris = intent.clipData?.let { clip -> (0 until clip.itemCount).map { clip.getItemAt(it).uri } } ?: listOfNotNull(intent.data)
        worker.execute {
          val files = mutableListOf<Map<String, Any>>()
          var skipped = 0
          for (uri in uris) {
            try { files.add(importFile(uri)) } catch (_: Exception) { skipped++ }
          }
          promise.resolve(Arguments.makeNativeMap(mapOf("files" to files, "skipped" to skipped)))
        }
      }
    })
  }
  @ReactMethod fun importAudio(promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) { promise.reject("no_activity", "Open Crimson and try again."); return }
    activity.runOnUiThread {
      if (picker != null) { promise.reject("picker_open", "The audio picker is already open."); return@runOnUiThread }
      picker = promise
      try {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          type = "audio/*"
          addCategory(Intent.CATEGORY_OPENABLE)
          putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivityForResult(intent, requestCode)
      } catch (error: Exception) { picker = null; promise.reject("picker_failed", "The audio picker could not be opened.", error) }
    }
  }
  private fun importFile(uri: Uri): Map<String, Any> {
    var name = "Imported audio"
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
      if (it.moveToFirst()) name = it.getString(0) ?: name
    }
    val temporary = File.createTempFile("import-", ".partial", directory)
    try {
      val hash = MessageDigest.getInstance("SHA-256")
      context.contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "The file provider did not return audio." }
        temporary.outputStream().use { output ->
          val buffer = ByteArray(256 * 1024)
          while (true) { val count = input.read(buffer); if (count <= 0) break; hash.update(buffer, 0, count); output.write(buffer, 0, count) }
        }
      }
      require(temporary.length() > 0) { "This file is empty." }
      val key = hash.digest().joinToString("") { "%02x".format(it) }
      val extension = name.substringAfterLast('.', "audio").lowercase().filter { it.isLetterOrDigit() }.take(12)
      val destination = File(directory, "$key.$extension")
      if (!destination.exists()) check(temporary.renameTo(destination)) { "The imported copy could not be saved." }
      val metadata = metadata(destination, name)
      File(destination.path + ".json").writeText(JSONObject(metadata).toString())
      return metadata
    } finally { temporary.delete() }
  }
  private fun metadata(file: File, name: String): MutableMap<String, Any> {
    val result = mutableMapOf<String, Any>(
      "id" to "import:${file.name}", "uri" to Uri.fromFile(file).toString(), "filename" to name,
      "title" to name.substringBeforeLast('.'), "kind" to "import", "size" to file.length().toDouble(), "modifiedAt" to file.lastModified().toDouble(), "duration" to 0.0
    )
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(file.path)
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.let { result["title"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.let { result["artist"] = it }
      retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.let { result["album"] = it }
      result["duration"] = (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0) / 1000
      // A sidecar keeps cover data out of the serialized library and its AsyncStorage limit.
      retriever.embeddedPicture?.takeIf { it.size <= 8 * 1024 * 1024 }?.let { bytes ->
        val art = File(directory, file.name + ".art")
        art.writeBytes(bytes); result["artwork"] = Uri.fromFile(art).toString()
      }
    } catch (_: Exception) { /* Keep all audio formats visible; the decoder reports playback support. */ }
    finally { retriever.release() }
    return result
  }
  @ReactMethod fun listImported(promise: Promise) {
    worker.execute {
      try {
        val extensions = setOf("mp3", "mp2", "m4a", "m4b", "m4r", "aac", "wav", "wave", "flac", "ogg", "oga", "opus", "aif", "aiff", "aifc", "alac", "wma", "amr", "mka", "au", "snd", "audio")
        val files = directory.walkTopDown().filter { file ->
          val extension = file.extension.lowercase()
          file.isFile && extension !in setOf("json", "art", "jpg", "jpeg", "png", "partial") &&
            (extension in extensions || File(file.path + ".json").isFile)
        }.map { file ->
          val sidecar = File(file.path + ".json")
          try {
            val json = JSONObject(sidecar.readText())
            json.keys().asSequence().associateWith { json.get(it) }.toMutableMap().also { it["uri"] = Uri.fromFile(file).toString() }
          } catch (_: Exception) { metadata(file, file.name) }
        }.toList()
        promise.resolve(Arguments.makeNativeArray(files))
      } catch (error: Exception) { promise.reject("scan_imports", "Imported audio could not be read.", error) }
    }
  }
  @ReactMethod fun scanDevice(promise: Promise) {
    worker.execute {
      try {
        val files = mutableListOf<Map<String, Any>>()
        val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val columns = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.ALBUM, MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.DATE_MODIFIED, MediaStore.Audio.Media.ALBUM_ID)
        // Do not filter IS_MUSIC: recordings, podcasts and other audio belong here too.
        context.contentResolver.query(uri, columns, "${MediaStore.Audio.Media.SIZE} > 0", null, "${MediaStore.Audio.Media.TITLE} ASC")?.use { cursor ->
          while (cursor.moveToNext()) {
            val id = cursor.getLong(0)
            files.add(mapOf(
              "id" to "android:$id", "uri" to ContentUris.withAppendedId(uri, id).toString(),
              "filename" to (cursor.getString(1) ?: "Audio $id"), "title" to (cursor.getString(2) ?: "Audio $id"),
              "artist" to (cursor.getString(3)?.takeUnless { it == "<unknown>" } ?: "Unknown artist"), "album" to (cursor.getString(4) ?: ""),
              "duration" to cursor.getLong(5).toDouble() / 1000, "size" to cursor.getLong(6).toDouble(), "modifiedAt" to cursor.getLong(7).toDouble() * 1000,
              "artwork" to "content://media/external/audio/albumart/${cursor.getLong(8)}", "kind" to "device"
            ))
          }
        }
        promise.resolve(Arguments.makeNativeMap(mapOf("files" to files, "skipped" to 0)))
      } catch (error: Exception) { promise.reject("scan_device", "Could not read device audio. Allow Music and audio access in system Settings.", error) }
    }
  }
  @ReactMethod fun resolveUri(uri: String, promise: Promise) {
    worker.execute {
      try {
        val parsed = Uri.parse(uri)
        require(parsed.scheme == "file" || parsed.scheme == "content") { "Invalid local audio address." }
        context.contentResolver.openAssetFileDescriptor(parsed, "r").use { requireNotNull(it) { "This file was removed. Scan or import it again." } }
        promise.resolve(uri)
      } catch (error: Exception) { promise.reject("local_file_missing", "This audio file is unavailable. Scan or import it again.", error) }
    }
  }
  @ReactMethod fun removeImport(uri: String, promise: Promise) {
    worker.execute {
      try {
        val file = File(requireNotNull(Uri.parse(uri).path)).canonicalFile
        require(file.path.startsWith(directory.canonicalPath + File.separator)) { "Only imported copies can be removed here." }
        check(!file.exists() || file.delete()) { "The imported copy could not be removed." }
        File(file.path + ".json").delete(); File(file.path + ".art").delete()
        promise.resolve(null)
      } catch (error: Exception) { promise.reject("remove_import", "The imported copy could not be removed.", error) }
    }
  }
}
