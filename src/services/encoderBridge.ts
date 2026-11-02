/**
 * Branchement de l'encodeur natif sur `CaptureSink`.
 *
 * Le module natif `UltracamEncoder` émet des trames en base64 (le pont React
 * Native ne transporte pas de `ArrayBuffer`). Cette couche les décode, filtre
 * les paires de SPS/PPS et les pousse dans le puits de capture.
 *
 * Si le module n'est pas compilé dans l'application, `getEncoder()` renvoie
 * `null` et l'interface se dégrade proprement en « aperçu seul ».
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { CaptureSink, EncoderCapabilities, EncoderConfig, registerEncoderProvider } from './capture';
import { ProSettings } from '../protocol/constants';

interface EncoderModuleEvents {
  config: { data: string; track?: 'video' | 'audio' };
  frame: { data: string; keyframe: boolean; ptsMicros: number; track?: 'video' | 'audio' };
  stats: { fps: number; bitrate: number; dropped: number };
}

interface UltracamEncoderModule {
  configure(config: EncoderConfig): Promise<EncoderCapabilities>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setOption(name: string, value: string | number | boolean): void;
  capabilities?(): Promise<EncoderCapabilities>;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Décodage base64 minimal, sans dépendre de `atob` ni de `Buffer`. */
export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

class BridgeEncoderFactory {
  private module: UltracamEncoderModule | null = null;

  create(): UltracamEncoderModule | null {
    const native = (NativeModules as Record<string, unknown>).UltracamEncoder as
      | UltracamEncoderModule
      | undefined;
    this.module = native ?? null;
    return this.module;
  }
}

const bridge = new BridgeEncoderFactory();

class BridgeEncoder {
  private sink: CaptureSink | null = null;
  private subscription: { remove(): void } | null = null;

  constructor(private readonly native: UltracamEncoderModule) {}

  async configure(config: EncoderConfig): Promise<EncoderCapabilities> {
    return this.native.configure(config);
  }

  async start(sink: CaptureSink): Promise<void> {
    this.stopListening();
    this.sink = sink;
    const emitter = new NativeEventEmitter(this.native as never);
    this.subscription = emitter.addListener('ultracam', (message: unknown) => {
      const { event, payload } = message as {
        event: keyof EncoderModuleEvents;
        payload: EncoderModuleEvents[keyof EncoderModuleEvents];
      };
      this.dispatch(event, payload);
    });
    await this.native.start();
  }

  private dispatch(
    event: keyof EncoderModuleEvents,
    payload: EncoderModuleEvents[keyof EncoderModuleEvents]
  ): void {
    const sink = this.sink;
    if (!sink) return;
    if (event === 'config') {
      const config = payload as EncoderModuleEvents['config'];
      const data = decodeBase64(config.data);
      if (config.track === 'audio') sink.onAudioConfig?.(data);
      else sink.onVideoConfig(data);
      return;
    }
    if (event === 'frame') {
      const frame = payload as EncoderModuleEvents['frame'];
      const data = decodeBase64(frame.data);
      if (frame.track === 'audio') {
        sink.onAudioFrame?.({ data, ptsMicros: frame.ptsMicros });
      } else {
        sink.onVideoFrame({ data, keyframe: frame.keyframe, ptsMicros: frame.ptsMicros });
      }
      return;
    }
    if (event === 'stats') sink.onStats?.(payload as EncoderModuleEvents['stats']);
  }

  async stop(): Promise<void> {
    this.stopListening();
    await this.native.stop();
    this.sink = null;
  }

  setOption(name: keyof ProSettings, value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      this.native.setOption(name, value);
    }
  }

  private stopListening(): void {
    this.subscription?.remove();
    this.subscription = null;
  }
}

/**
 * Enregistre l'encodeur natif si le module est présent. À appeler une fois au
 * démarrage de l'application (voir `app/_layout.tsx`).
 */
export function registerNativeEncoder(): boolean {
  const native = bridge.create();
  if (!native) return false;
  registerEncoderProvider(() => new BridgeEncoder(native));
  return true;
}
