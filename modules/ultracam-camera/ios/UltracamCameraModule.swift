import ExpoModulesCore
import AVFoundation
import UIKit
import CoreImage
import ImageIO

public class UltracamCameraModule: Module {
 public func definition() -> ModuleDefinition {
  Name("UltracamCamera")
  View(UltracamCameraView.self) {
   Events("onStatus")
   Prop("url") { (v: UltracamCameraView, value: String) in v.setEndpoint(value) }
   Prop("facing") { (v: UltracamCameraView, value: String) in v.setFacing(value) }
   Prop("torch") { (v: UltracamCameraView, value: Bool) in v.setTorch(value) }
   Prop("zoom") { (v: UltracamCameraView, value: Double) in v.setZoom(value) }
   Prop("fps") { (v: UltracamCameraView, value: Int) in v.fps = max(5,min(30,value)) }
   Prop("quality") { (v: UltracamCameraView, value: Int) in v.quality = CGFloat(max(30,min(95,value)))/100 }
  }
 }
}
class UltracamCameraView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
 let onStatus = EventDispatcher()
 private let capture = AVCaptureSession()
 private let captureQueue = DispatchQueue(label:"app.ultracam.capture")
 private let context = CIContext()
 private var preview: AVCaptureVideoPreviewLayer!
 private var device: AVCaptureDevice?
 private var socket: URLSessionWebSocketTask?
 private var endpoint = ""
 private var front = false
 private var frames = 0
 private var lastFrame = 0.0
 private var lastStatus = 0.0
 private var sending = false
 var fps = 15
 var quality: CGFloat = 0.75
 required init(appContext: AppContext? = nil) {
  super.init(appContext:appContext)
  preview = AVCaptureVideoPreviewLayer(session:capture)
  preview.videoGravity = .resizeAspect
  layer.addSublayer(preview)
 }
 override func layoutSubviews() { super.layoutSubviews();preview.frame=bounds }
 override func didMoveToWindow() {
  super.didMoveToWindow()
  if window != nil { configure(); if !endpoint.isEmpty { connect() } }
  else { socket?.cancel(with:.goingAway,reason:nil);socket=nil;captureQueue.async { self.capture.stopRunning() } }
 }
 private func status(_ state:String,_ text:String) { DispatchQueue.main.async { self.onStatus(["state":state,"message":text,"frames":self.frames]) } }
 func setEndpoint(_ value:String) { if value==endpoint{return};endpoint=value;socket?.cancel(with:.normalClosure,reason:nil);socket=nil;frames=0;if !value.isEmpty && window != nil {connect()} }
 func setFacing(_ value:String) { let next=value=="front";if next != front {front=next;if window != nil {configure()}} }
 func setTorch(_ value:Bool) { captureQueue.async { guard let d=self.device,d.hasTorch else{return};do{try d.lockForConfiguration();d.torchMode=value ? .on : .off;d.unlockForConfiguration()}catch{self.status("error","Torche indisponible")} } }
 func setZoom(_ value:Double) { captureQueue.async {guard let d=self.device else{return};do{try d.lockForConfiguration();d.videoZoomFactor=1+CGFloat(max(0,min(1,value)))*(min(d.activeFormat.videoMaxZoomFactor,8)-1);d.unlockForConfiguration()}catch{}} }
 private func connect() {
  guard let url=URL(string:endpoint),["ws","wss"].contains(url.scheme ?? "") else {status("error","Adresse invalide");return}
  let ws=URLSession.shared.webSocketTask(with:url);socket=ws;ws.resume();status("connecting","Connexion au Studio…")
  let hello:[String:Any] = ["type":"hello","name":UIDevice.current.model,"platform":"ios","version":1]
  if let data=try? JSONSerialization.data(withJSONObject:hello),let text=String(data:data,encoding:.utf8){ws.send(.string(text)){[weak self]error in if error != nil {self?.status("error","Connexion impossible")}}}
  receive(ws)
 }
 private func receive(_ ws:URLSessionWebSocketTask) { ws.receive { [weak self] result in
  guard let self=self,self.socket===ws else{return}
  switch result {
   case .failure(_): self.socket=nil;self.status("error","Connexion perdue. Reconnectez-vous.")
   case .success(let message):
    if case .string(let text)=message,let data=text.data(using:.utf8),let j=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] {
     switch j["type"] as? String {case "torch":self.setTorch(j["value"] as? Bool ?? false);case "zoom":self.setZoom(j["value"] as? Double ?? 0);case "facing":self.setFacing(j["value"] as? String ?? "back");case "fps":self.fps=max(5,min(30,j["value"] as? Int ?? 15));default:break}
    };self.receive(ws)
  }
 } }
 private func configure() { captureQueue.async {
  self.capture.beginConfiguration();self.capture.sessionPreset = .hd1280x720
  self.capture.inputs.forEach{self.capture.removeInput($0)};self.capture.outputs.forEach{self.capture.removeOutput($0)}
  guard let d=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:self.front ? .front:.back),let input=try? AVCaptureDeviceInput(device:d),self.capture.canAddInput(input) else {self.capture.commitConfiguration();self.status("error","Caméra indisponible");return}
  self.device=d;self.capture.addInput(input)
  let output=AVCaptureVideoDataOutput();output.alwaysDiscardsLateVideoFrames=true;output.videoSettings=[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA];output.setSampleBufferDelegate(self,queue:self.captureQueue)
  if self.capture.canAddOutput(output){self.capture.addOutput(output)}
  if let connection=output.connection(with:.video),connection.isVideoOrientationSupported { connection.videoOrientation = .portrait }
  self.capture.commitConfiguration();if !self.capture.isRunning {self.capture.startRunning()}
 } }
 func captureOutput(_ output:AVCaptureOutput,didOutput sampleBuffer:CMSampleBuffer,from connection:AVCaptureConnection) {
  let now=CACurrentMediaTime()
  guard let ws=socket,!sending,now-lastFrame>=1/Double(fps),let buffer=CMSampleBufferGetImageBuffer(sampleBuffer) else{return}
  lastFrame=now
  let image=CIImage(cvPixelBuffer:buffer)
  guard let jpeg=context.jpegRepresentation(of:image,colorSpace:CGColorSpaceCreateDeviceRGB(),options:[CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String):quality]) else{return}
  sending=true
  ws.send(.data(jpeg)){[weak self]error in guard let self=self else{return};self.captureQueue.async {self.sending=false;if error==nil {self.frames+=1;if now-self.lastStatus>1 {self.lastStatus=now;self.status("streaming","En direct · caméra active")}}}}
 }
}
