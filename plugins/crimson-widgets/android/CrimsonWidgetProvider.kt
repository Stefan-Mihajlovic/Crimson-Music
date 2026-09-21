package __PACKAGE__.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import __PACKAGE__.R
import java.io.File
import org.json.JSONObject

open class CrimsonWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { update(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    update(context, manager, id)
  }

  companion object {
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      listOf(CrimsonSmallWidget::class.java, CrimsonMediumWidget::class.java, CrimsonLargeWidget::class.java).forEach { provider ->
        manager.getAppWidgetIds(ComponentName(context, provider)).forEach { update(context, manager, it) }
      }
    }

    private fun pending(context: Context, action: String, kind: String? = null): PendingIntent {
      val uri = Uri.Builder().scheme("crimsonmusic").authority("widget").appendQueryParameter("action", action)
      if (kind != null) uri.appendQueryParameter("kind", kind)
      // Explicit activity intent avoids Android's prohibited widget broadcast trampolines.
      val intent = Intent(Intent.ACTION_VIEW, uri.build()).setClassName(context, "__PACKAGE__.MainActivity")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      return PendingIntent.getActivity(context, "$action:$kind".hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val info = manager.getAppWidgetInfo(id) ?: return
      val size = when (info.provider.className.substringAfterLast('.')) {
        "CrimsonLargeWidget" -> "large"
        "CrimsonMediumWidget" -> "medium"
        else -> "small"
      }
      val layout = when (size) {
        "large" -> R.layout.crimson_widget_large
        "medium" -> R.layout.crimson_widget_medium
        else -> R.layout.crimson_widget_small
      }
      val preferences = context.getSharedPreferences("crimson_widgets", 0)
      val snapshot = try { JSONObject(preferences.getString("snapshot", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
      val views = RemoteViews(context.packageName, layout)
      val title = snapshot.optString("title", "Your music, ready")
      val artist = snapshot.optString("artist", "Open Crimson to start listening")
      views.setTextViewText(R.id.crimson_title, title)
      views.setTextViewText(R.id.crimson_artist, artist)
      views.setOnClickPendingIntent(R.id.crimson_root, pending(context, "resume"))
      views.setContentDescription(R.id.crimson_root, "$title, $artist. Open Crimson and resume")
      val source = snapshot.optString("artworkUrl")
      val file = File(context.filesDir, "crimson-widget-artwork.jpg")
      val bitmap = if (source.isNotEmpty() && preferences.getString("artworkSource", "") == source && file.exists()) BitmapFactory.decodeFile(file.path) else null
      if (bitmap != null) views.setImageViewBitmap(R.id.crimson_artwork, bitmap)
      else views.setImageViewResource(R.id.crimson_artwork, R.drawable.crimson_widget_note)
      if (size != "small") {
        val playing = snapshot.optBoolean("playing")
        views.setImageViewResource(R.id.crimson_play, if (playing) R.drawable.crimson_widget_pause else R.drawable.crimson_widget_play)
        views.setContentDescription(R.id.crimson_play, if (playing) "Open Crimson and pause" else "Open Crimson and resume")
        views.setOnClickPendingIntent(R.id.crimson_play, pending(context, if (playing) "pause" else "resume"))
        views.setOnClickPendingIntent(R.id.crimson_next, pending(context, if (snapshot.optBoolean("canGoNext")) "next" else "library"))
        views.setInt(R.id.crimson_next, "setImageAlpha", if (snapshot.optBoolean("canGoNext")) 255 else 80)
        views.setOnClickPendingIntent(R.id.crimson_favorites, pending(context, "favorites"))
        views.setOnClickPendingIntent(R.id.crimson_daily, pending(context, "mix", "daily"))
      }
      if (size == "large") {
        views.setOnClickPendingIntent(R.id.crimson_previous, pending(context, if (snapshot.optBoolean("canGoPrevious")) "previous" else "library"))
        views.setInt(R.id.crimson_previous, "setImageAlpha", if (snapshot.optBoolean("canGoPrevious")) 255 else 80)
        val next = snapshot.optString("nextTitle")
        views.setTextViewText(R.id.crimson_up_next, if (next.isNotEmpty()) "Up next · $next" else "Make room for a new favorite")
        views.setOnClickPendingIntent(R.id.crimson_weekly, pending(context, "mix", "weekly"))
        views.setOnClickPendingIntent(R.id.crimson_monthly, pending(context, "mix", "monthly"))
        views.setOnClickPendingIntent(R.id.crimson_local, pending(context, "local"))
        views.setOnClickPendingIntent(R.id.crimson_history, pending(context, "history"))
      }
      manager.updateAppWidget(id, views)
    }
  }
}

class CrimsonSmallWidget : CrimsonWidgetProvider()
class CrimsonMediumWidget : CrimsonWidgetProvider()
class CrimsonLargeWidget : CrimsonWidgetProvider()
