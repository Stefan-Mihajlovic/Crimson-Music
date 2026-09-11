@file:Suppress("DEPRECATION")

package expo.modules.blur

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.renderscript.Allocation
import android.renderscript.Element
import android.renderscript.RenderScript
import android.renderscript.ScriptIntrinsicBlur
import eightbitlab.com.blurview.BlurAlgorithm

/** An independently owned RS context: replacing one blur must not invalidate another. */
internal class CrimsonRenderScriptBlur(context: Context) : BlurAlgorithm {
  private val scriptContext = RenderScript.createMultiContext(
    context.applicationContext, RenderScript.ContextType.NORMAL, 0, context.applicationInfo.targetSdkVersion
  )
  private val script = ScriptIntrinsicBlur.create(scriptContext, Element.U8_4(scriptContext))
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
  private var input: Allocation? = null
  private var output: Allocation? = null
  private var width = 0
  private var height = 0
  private var destroyed = false

  override fun blur(bitmap: Bitmap, blurRadius: Float): Bitmap {
    check(!destroyed) { "Cannot reuse a released Crimson blur" }
    if (bitmap.width != width || bitmap.height != height) {
      input?.destroy()
      output?.destroy()
      input = Allocation.createFromBitmap(scriptContext, bitmap)
      output = Allocation.createTyped(scriptContext, input!!.type)
      width = bitmap.width
      height = bitmap.height
    } else {
      input!!.copyFrom(bitmap)
    }
    script.setRadius(blurRadius.coerceIn(0.1f, 25f))
    script.setInput(input)
    script.forEach(output)
    output!!.copyTo(bitmap)
    return bitmap
  }

  override fun render(canvas: Canvas, bitmap: Bitmap) { canvas.drawBitmap(bitmap, 0f, 0f, paint) }
  override fun canModifyBitmap() = true
  override fun getSupportedBitmapConfig() = Bitmap.Config.ARGB_8888

  override fun destroy() {
    if (destroyed) return
    destroyed = true
    input?.destroy()
    output?.destroy()
    input = null
    output = null
    script.destroy()
    scriptContext.destroy()
  }
}
