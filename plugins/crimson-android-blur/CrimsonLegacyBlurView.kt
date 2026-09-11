package expo.modules.blur

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.os.SystemClock
import android.view.View
import android.view.ViewTreeObserver
import eightbitlab.com.blurview.BlurAlgorithm
import eightbitlab.com.blurview.BlurTarget
import eightbitlab.com.blurview.BlurView
import eightbitlab.com.blurview.BlurViewFacade
import kotlin.math.ceil

/** Android 7–11: capture/blur a target once per frame, shared by all its controls. */
internal class CrimsonLegacyBlurView(context: Context) : BlurView(context) {
  private var target: BlurTarget? = null
  private var snapshot: SharedSnapshot? = null
  private var enabled = true
  private var autoUpdate = true
  private var radius = 14.5f
  private val visibleBounds = Rect()
  private val location = IntArray(2)
  private val destination = RectF()
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
  init { setWillNotDraw(false) }
  private val facade = object : BlurViewFacade {
    override fun setBlurEnabled(value: Boolean) = this@CrimsonLegacyBlurView.setBlurEnabled(value)
    override fun setBlurAutoUpdate(value: Boolean) = this@CrimsonLegacyBlurView.setBlurAutoUpdate(value)
    override fun setBlurRadius(value: Float) = this@CrimsonLegacyBlurView.setBlurRadius(value)
    override fun setOverlayColor(value: Int) = this@CrimsonLegacyBlurView.setOverlayColor(value)
    override fun setFrameClearDrawable(value: Drawable?) = this
  }

  override fun setupWith(target: BlurTarget, algorithm: BlurAlgorithm?, scaleFactor: Float, applyNoise: Boolean): BlurViewFacade {
    detachSnapshot()
    algorithm?.destroy()
    this.target = target
    // setupWith creates an enabled controller in Dimezis, even if the old
    // controller was disabled while Expo was waiting for its target ref.
    enabled = true
    autoUpdate = true
    attachSnapshot()
    return facade
  }

  override fun setBlurEnabled(value: Boolean): BlurViewFacade {
    enabled = value
    if (value) attachSnapshot() else detachSnapshot()
    invalidate()
    return facade
  }

  override fun setBlurAutoUpdate(value: Boolean): BlurViewFacade {
    autoUpdate = value
    return facade
  }

  override fun setBlurRadius(value: Float): BlurViewFacade {
    radius = value
    return facade
  }

  // Color and opacity are supplied by the existing JS surface, without a second tint.
  override fun setOverlayColor(value: Int): BlurViewFacade = facade

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attachSnapshot()
  }

  override fun onDetachedFromWindow() {
    detachSnapshot()
    super.onDetachedFromWindow()
  }

  private fun attachSnapshot() {
    val root = target ?: return
    if (!enabled || !isAttachedToWindow || snapshot != null) return
    snapshot = snapshots.getOrPut(root) { SharedSnapshot(root) }.also { it.clients.add(this) }
  }

  private fun detachSnapshot() {
    val old = snapshot ?: return
    snapshot = null
    old.clients.remove(this)
    if (old.clients.isEmpty()) {
      snapshots.remove(old.target)
      old.destroy()
    }
  }

  private fun isVisibleForCapture(): Boolean {
    if (!enabled || !autoUpdate || !isShown || !getGlobalVisibleRect(visibleBounds)) return false
    var ancestor: View? = this
    while (ancestor != null) {
      if (ancestor.alpha <= 0.01f) return false
      ancestor = ancestor.parent as? View
    }
    return true
  }

  override fun draw(canvas: Canvas) {
    // Layered targets may contain other frosted controls. Never capture their blur again.
    if (capturing || !enabled) return
    val shared = snapshot ?: return
    val bitmap = shared.bitmap ?: return
    getLocationOnScreen(location)
    shared.target.getLocationOnScreen(shared.location)
    val x = (shared.location[0] + shared.bounds.left - location[0]).toFloat()
    val y = (shared.location[1] + shared.bounds.top - location[1]).toFloat()
    destination.set(x, y, x + shared.bounds.width(), y + shared.bounds.height())
    canvas.drawBitmap(bitmap, null, destination, paint)
  }

  private class SharedSnapshot(val target: BlurTarget) : ViewTreeObserver.OnPreDrawListener {
    val clients = mutableSetOf<CrimsonLegacyBlurView>()
    val location = IntArray(2)
    val bounds = Rect()
    private var nextCaptureAt = 0L
    var bitmap: Bitmap? = null
    private var canvas: Canvas? = null
    private val blur = CrimsonRenderScriptBlur(target.context)

    init { target.viewTreeObserver.addOnPreDrawListener(this) }

    override fun onPreDraw(): Boolean {
      if (SystemClock.uptimeMillis() < nextCaptureAt) return true
      val visible = clients.filter { it.isVisibleForCapture() }
      if (visible.isEmpty() || target.width <= 0 || target.height <= 0) return true
      target.getLocationOnScreen(location)
      bounds.setEmpty()
      visible.forEach { bounds.union(it.visibleBounds) }
      bounds.offset(-location[0], -location[1])
      val padding = ceil(visible.maxOf { it.radius } * 6f).toInt()
      bounds.inset(-padding, -padding)
      if (!bounds.intersect(0, 0, target.width, target.height)) return true
      val width = ceil(bounds.width() / 8f).toInt().coerceAtLeast(1)
      val height = ceil(bounds.height() / 8f).toInt().coerceAtLeast(1)
      if (bitmap?.width != width || bitmap?.height != height) {
        // Let Android release the old bitmap after its display lists stop using it.
        bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        canvas = Canvas(bitmap!!)
        clients.forEach { it.invalidate() }
      }
      val frame = bitmap!!
      val drawing = canvas!!
      frame.eraseColor(Color.TRANSPARENT)
      drawing.save()
      drawing.scale(width.toFloat() / bounds.width(), height.toFloat() / bounds.height())
      drawing.translate(-bounds.left.toFloat(), -bounds.top.toFloat())
      capturing = true
      try { target.draw(drawing) } finally {
        capturing = false
        drawing.restore()
      }
      blur.blur(frame, (visible.maxOf { it.radius } * 0.75f).coerceIn(0.1f, 25f))
      // Leave time for input/animation on legacy devices. No timer or extra frame
      // is scheduled: content invalidation drives the next snapshot.
      nextCaptureAt = SystemClock.uptimeMillis() + 50L
      visible.forEach { it.invalidate() }
      return true
    }

    fun destroy() {
      target.viewTreeObserver.removeOnPreDrawListener(this)
      blur.destroy()
      bitmap = null
      canvas = null
    }
  }

  companion object {
    // All operations and drawing occur on Android's UI thread.
    private val snapshots = mutableMapOf<BlurTarget, SharedSnapshot>()
    private var capturing = false
  }
}
