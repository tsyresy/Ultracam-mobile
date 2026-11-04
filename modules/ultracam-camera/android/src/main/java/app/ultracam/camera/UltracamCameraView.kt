package app.ultracam.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import okhttp3.*
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class UltracamCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
 // PreviewView adds its rendering surface asynchronously. React Native otherwise
 // suppresses that child's layout request, leaving CameraX waiting for a surface.
 override val shouldUseAndroidLayout = true
 private val preview = PreviewView(context)
 private val onStatus by EventDispatcher()
 private val onControls by EventDispatcher()
 private class EncoderBuffers {
  var pixels: java.nio.ByteBuffer? = null
  var row = ByteArray(0)
  var bitmap: Bitmap? = null
  val jpeg = ByteArrayOutputStream()
 }
 private val encoderBuffers = ThreadLocal.withInitial { EncoderBuffers() }
 private val client = OkHttpClient.Builder().pingInterval(10,TimeUnit.SECONDS).build()
 private var worker = Executors.newSingleThreadExecutor()
 private var provider: ProcessCameraProvider? = null
 private var camera: Camera? = null
 private var analysis: ImageAnalysis? = null
 private var previewUseCase: Preview? = null
 @Volatile private var socket: WebSocket? = null
 @Volatile private var ready = false
 private var endpoint = ""
 private var front = false
 private var torch = false
 private var zoom = 0f
 @Volatile var fps = 15
 @Volatile var quality = 75
 private var lastFrame = 0L
 private var lastStatus = 0L
 private var frameCount = 0
 @Volatile private var generation = 0
 init {
  preview.scaleType = PreviewView.ScaleType.FIT_CENTER
  preview.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  addView(preview, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
 }
 override fun onLayout(changed: Boolean,l:Int,t:Int,r:Int,b:Int) { preview.layout(0,0,r-l,b-t) }
 private fun status(state:String,message:String) { val current=generation; post { if(current==generation && isAttachedToWindow) onStatus(mapOf("state" to state,"message" to message,"frames" to frameCount)) } }
 override fun onAttachedToWindow() { super.onAttachedToWindow(); if(worker.isShutdown) worker=Executors.newSingleThreadExecutor(); bindCamera(); if(endpoint.isNotEmpty()) connect() }
 override fun onDetachedFromWindow() {
  generation++; ready=false; socket?.close(1000,"View closed");socket=null
  analysis?.let { provider?.unbind(it) };previewUseCase?.let { provider?.unbind(it) };worker.execute { encoderBuffers.get()?.bitmap?.recycle();encoderBuffers.remove() };worker.shutdown()
  super.onDetachedFromWindow()
 }
 fun setEndpoint(value:String) { if(endpoint==value)return;endpoint=value;generation++;ready=false;socket?.close(1000,"Reconnect");socket=null;frameCount=0;if(isAttachedToWindow&&value.isNotEmpty())connect() }
 fun setFacing(value:String) { val next=value=="front";if(next!=front){front=next;if(front)torch=false;if(isAttachedToWindow)bindCamera()} }
 fun setTorch(value:Boolean) { torch=value;camera?.let { if(it.cameraInfo.hasFlashUnit())it.cameraControl.enableTorch(value) } }
 fun setZoom(value:Float) { zoom=value.coerceIn(0f,1f);camera?.cameraControl?.setLinearZoom(zoom) }
 private fun connect() {
  val current=++generation
  try {
   val request=Request.Builder().url(endpoint).build()
   status("connecting","Connexion au Studio…")
   socket=client.newWebSocket(request,object:WebSocketListener(){
    override fun onOpen(ws:WebSocket,response:Response){ if(current!=generation){ws.close(1000,"Stale");return};ready=true;ws.send(JSONObject().put("type","hello").put("name",android.os.Build.MODEL).put("platform","android").put("version",1).toString());status("connected","Connecté au Studio") }
    override fun onMessage(ws:WebSocket,text:String){ if(current!=generation)return;try { val j=JSONObject(text);post { if(current!=generation)return@post;when(j.optString("type")){"torch"->setTorch(j.optBoolean("value"));"zoom"->setZoom(j.optDouble("value").toFloat());"facing"->setFacing(j.optString("value"));"fps"->{fps=j.optInt("value",15).coerceIn(5,30)};"exposure"->{camera?.let { c->val range=c.cameraInfo.exposureState.exposureCompensationRange;c.cameraControl.setExposureCompensationIndex(j.optInt("value").coerceIn(range.lower,range.upper)) }}};onControls(mapOf("facing" to if(front) "front" else "back", "torch" to torch, "zoom" to zoom, "fps" to fps)) } }catch(_:Exception){} }
    override fun onFailure(ws:WebSocket,t:Throwable,response:Response?){ if(current==generation){ready=false;status("error","Connexion perdue : ${response?.code ?: t.javaClass.simpleName}. Reconnectez-vous.")} }
    override fun onClosed(ws:WebSocket,code:Int,reason:String){if(current==generation){ready=false;status("closed","Studio déconnecté")}}
    override fun onClosing(ws:WebSocket,code:Int,reason:String){ws.close(code,reason)}
   })
  }catch(e:Exception){status("error","Adresse non valide")}
 }
 private fun bindCamera() {
  val future=ProcessCameraProvider.getInstance(context)
  future.addListener({
   if(!isAttachedToWindow)return@addListener
   try {
    val p=future.get();provider=p
    analysis?.let{p.unbind(it)};previewUseCase?.let{p.unbind(it)}
    // The legacy target size is interpreted relative to display rotation and can
    // select a multi-megapixel square stream on portrait Xiaomi devices. Bound
    // the sensor dimensions explicitly before CameraX negotiates its use cases.
    val resolution=ResolutionSelector.Builder()
     .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
     .setResolutionStrategy(ResolutionStrategy(android.util.Size(1920,1080),ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER))
     .setResolutionFilter { sizes, _ -> sizes.filter { maxOf(it.width,it.height)<=1920 && minOf(it.width,it.height)<=1080 } }
     .build()
    val surface=Preview.Builder().setResolutionSelector(resolution).build().also{it.setSurfaceProvider(preview.surfaceProvider)}
    val stream=ImageAnalysis.Builder().setResolutionSelector(resolution).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888).build()
    stream.setAnalyzer(worker){frame->try{encode(frame)}catch(_:Exception){status("error","Impossible de traiter cette image")}finally{frame.close()}}
    val owner=appContext.currentActivity as? LifecycleOwner ?: throw IllegalStateException("No lifecycle")
    val selector=if(front)CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
    camera=p.bindToLifecycle(owner,selector,surface,stream);analysis=stream;previewUseCase=surface;setTorch(torch);setZoom(zoom)
   }catch(e:Exception){status("error","Caméra indisponible : ${e.javaClass.simpleName}")}
  },ContextCompat.getMainExecutor(context))
 }
 private fun encode(frame:ImageProxy) {
  val ws=socket ?: return
  val current=generation
  val now=SystemClock.elapsedRealtime()
  if(!ready||now-lastFrame<1000/fps||ws.queueSize()>2_000_000)return
  lastFrame=now
  val plane=frame.planes[0]
  val buffers=checkNotNull(encoderBuffers.get())
  if(buffers.bitmap?.width!=frame.width || buffers.bitmap?.height!=frame.height) {
   buffers.bitmap?.recycle();buffers.bitmap=Bitmap.createBitmap(frame.width,frame.height,Bitmap.Config.ARGB_8888)
   buffers.pixels=java.nio.ByteBuffer.allocate(frame.width*frame.height*4);buffers.row=ByteArray(frame.width*4)
  }
  val raw=buffers.bitmap!!
  val packed=buffers.pixels!!;packed.clear()
  val row=buffers.row
  for(y in 0 until frame.height){plane.buffer.position(y*plane.rowStride);plane.buffer.get(row);packed.put(row)}
  packed.rewind();raw.copyPixelsFromBuffer(packed)
  val matrix=Matrix().apply{postRotate(frame.imageInfo.rotationDegrees.toFloat())}
  val image=Bitmap.createBitmap(raw,0,0,frame.width,frame.height,matrix,true)
  buffers.jpeg.reset()
  try { image.compress(Bitmap.CompressFormat.JPEG,quality,buffers.jpeg) } finally { if(image!==raw)image.recycle() }
  if(current!=generation || ws!==socket || !ready)return
  if(ws.send(buffers.jpeg.toByteArray().toByteString()))frameCount++
  if(now-lastStatus>1000){lastStatus=now;status("streaming","En direct · caméra active")}
 }
}
