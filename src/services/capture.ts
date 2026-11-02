/**
 * Abstraction de capture vidéo.
 *
 * Le streaming temps réel exige un encodeur matériel (MediaCodec / VideoToolbox)
 * qui ne peut pas être piloté depuis le JavaScript d'Expo : il faut un module
 * natif. Cette couche définit donc le **contrat** que ce module expose et
 * fournit une implémentation de repli basée sur `MediaRecorder` (web) et sur
 * `expo-camera` (aperçu seul, sans flux) afin que l'interface fonctionne même
 * lorsque l'encodeur natif n'est pas installé.
 *
 * Contrat du module natif attendu (`UltracamEncoder`), à implémenter côté
 * `modules/ultracam-encoder/{android,ios}` :
 *
 *   configure(opts: EncoderConfig): Promise<EncoderCapabilities>
 *   start(): Promise<void>
 *   stop(): Promise<void>
 *   setOption(name: string, value: number | boolean | string): void
 *   // Événements : 'frame' -> { data: base64, keyframe: boolean, ptsMicros }
 *   //              'config' -> { data: base64 }  (SPS/PPS, AVCDecoderConfigurationRecord)
 */

import { ProSettings } from '../protocol/constants';

export interface EncoderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: 'h264' | 'hevc';
  lens: 'front' | 'back';
  microphone: boolean;
}

export interface EncoderCapabilities {
  codecs: Array<'h264' | 'hevc'>;
  maxWidth: number;
  maxHeight: number;
  maxFps: number;
  hardwareAccelerated: boolean;
  /** Le module peut-il encoder l'audio (AAC/Opus) ? */
  audio: boolean;
}

export interface EncodedFrame {
  data: Uint8Array;
  keyframe: boolean;
  ptsMicros: number;
}

export interface EncodedAudio {
  data: Uint8Array;
  ptsMicros: number;
}

export interface CaptureSink {
  onVideoConfig(config: Uint8Array): void;
  onVideoFrame(frame: EncodedFrame): void;
  onAudioConfig?(config: Uint8Array): void;
  onAudioFrame?(frame: EncodedAudio): void;
  onStats?(stats: { fps: number; bitrate: number; dropped: number }): void;
}

/** Encodeur réel fourni par le module natif. */
export interface NativeEncoder {
  configure(config: EncoderConfig): Promise<EncoderCapabilities>;
  start(sink: CaptureSink): Promise<void>;
  stop(): Promise<void>;
  setOption(name: keyof ProSettings, value: unknown): void;
}

export type EncoderProvider = () => NativeEncoder | null;

let provider: EncoderProvider = () => null;

/**
 * Enregistre le module natif. Le code Expo appelle cette fonction depuis
 * `modules/ultracam-encoder` ; sans module, l'application fonctionne en
 * mode « aperçu seul » et le bouton de diffusion est désactivé.
 */
export function registerEncoderProvider(next: EncoderProvider): void {
  provider = next;
}

export function getEncoder(): NativeEncoder | null {
  try {
    return provider();
  } catch {
    return null;
  }
}

export function isEncoderAvailable(): boolean {
  return getEncoder() !== null;
}

/** Convertit les réglages Pro en configuration d'encodeur. */
export function encoderConfigFrom(settings: ProSettings): EncoderConfig {
  return {
    width: settings.resolution.width,
    height: settings.resolution.height,
    fps: settings.fps,
    bitrate: settings.bitrateKbps * 1000,
    codec: settings.codec,
    lens: settings.lens,
    microphone: settings.audioEnabled,
  };
}
