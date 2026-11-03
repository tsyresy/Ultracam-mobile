package app.ultracam.camera
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
class UltracamCameraModule : Module() {
 override fun definition() = ModuleDefinition {
  Name("UltracamCamera")
  View(UltracamCameraView::class) {
   Events("onStatus", "onControls")
   Prop("url") { view: UltracamCameraView, value: String -> view.setEndpoint(value) }
   Prop("facing") { view: UltracamCameraView, value: String -> view.setFacing(value) }
   Prop("torch") { view: UltracamCameraView, value: Boolean -> view.setTorch(value) }
   Prop("zoom") { view: UltracamCameraView, value: Float -> view.setZoom(value) }
   Prop("fps") { view: UltracamCameraView, value: Int -> view.fps = value.coerceIn(5,30) }
   Prop("quality") { view: UltracamCameraView, value: Int -> view.quality = value.coerceIn(30,95) }
  }
 }
}
