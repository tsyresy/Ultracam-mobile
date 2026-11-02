/**
 * Protocole Ultracam — côté mobile.
 *
 * DOIT rester aligné sur `UltraCamStudio/src/protocol.ts`.
 * Toute modification de la version du protocole doit être appliquée aux deux.
 */

export const PROTOCOL_VERSION = 1;
export const SERVICE_TYPE = 'ultracam';
export const DEFAULT_PORT = 47900;
export const WS_PATH_SIGNAL = '/signal';
export const WS_PATH_MEDIA = '/media';
export const WS_PATH_HEALTH = '/health';

/** Sous-protocoles WebSocket (négociés via Sec-WebSocket-Protocol). */
export const WS_SUBPROTOCOL_SIGNAL = 'ultracam.signal.v1';
export const WS_SUBPROTOCOL_MEDIA = 'ultracam.media.v1';

export enum SignalType {
  Hello = 'hello',
  Welcome = 'welcome',
  Authenticate = 'authenticate',
  Authenticated = 'authenticated',
  PairingRequired = 'pairing-required',
  StreamStart = 'stream-start',
  StreamStop = 'stream-stop',
  Stats = 'stats',
  Ping = 'ping',
  Pong = 'pong',
  Error = 'error',
  Settings = 'settings',
  SettingsState = 'settings-state',
}

export enum MediaFrameType {
  Headers = 0x01,
  Config = 0x02,
  KeyFrame = 0x03,
  DeltaFrame = 0x04,
  AudioConfig = 0x05,
  AudioFrame = 0x06,
  EndHeaders = 0x07,
  Metadata = 0x08,
}

export const FRAME_HEADER_SIZE = 4;
export const VIDEO_STREAM_ID = 1;
export const AUDIO_STREAM_ID = 2;

export interface HelloMessage {
  type: SignalType.Hello;
  protocol: number;
  deviceName: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  deviceId: string;
}

export interface WelcomeMessage {
  type: SignalType.Welcome;
  protocol: number;
  studioName: string;
  authenticated: boolean;
}

export interface AuthenticateMessage {
  type: SignalType.Authenticate;
  deviceId: string;
  pairingCode?: string;
  token?: string;
}

export interface AuthenticatedMessage {
  type: SignalType.Authenticated;
  token: string;
  role: 'publisher';
}

export interface StreamStartMessage {
  type: SignalType.StreamStart;
  video: {
    codec: 'h264' | 'hevc';
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
  audio?: {
    codec: 'aac' | 'opus';
    sampleRate: number;
    channels: number;
    bitrate: number;
  };
}

export interface ProSettings {
  lens: 'front' | 'back';
  zoom: number;
  torch: boolean;
  whiteBalance: number;
  exposureCompensation: number;
  focus: number;
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  sharpness: number;
  hue: number;
  preset: string;
  hdr: boolean;
  stabilization: boolean;
  mirror: boolean;
  beauty: number;
  cleanFrame: boolean;
  resolution: { width: number; height: number };
  fps: number;
  bitrateKbps: number;
  codec: 'h264' | 'hevc';
  audioEnabled: boolean;
  audioCodec: 'aac' | 'opus';
  audioBitrateKbps: number;
}

export const DEFAULT_PRO_SETTINGS: ProSettings = {
  lens: 'back',
  zoom: 1,
  torch: false,
  whiteBalance: 0,
  exposureCompensation: 0,
  focus: 0.5,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 1,
  sharpness: 0,
  hue: 0,
  preset: 'none',
  hdr: false,
  stabilization: true,
  mirror: true,
  beauty: 0,
  cleanFrame: true,
  resolution: { width: 1280, height: 720 },
  fps: 30,
  bitrateKbps: 6000,
  codec: 'h264',
  audioEnabled: true,
  audioCodec: 'opus',
  audioBitrateKbps: 128,
};

export interface SettingsMessage {
  type: SignalType.Settings;
  settings: Partial<ProSettings>;
}

export interface SettingsStateMessage {
  type: SignalType.SettingsState;
  settings: ProSettings;
}

export type IncomingSignal =
  | WelcomeMessage
  | AuthenticatedMessage
  | SettingsMessage
  | SettingsStateMessage
  | { type: SignalType.PairingRequired }
  | { type: SignalType.Error; code: string; message: string }
  | { type: SignalType.Pong };

/** Encapsule un NAL / payload dans une trame média Ultracam. */
export function encodeMediaFrame(
  streamId: number,
  type: MediaFrameType,
  payload: Uint8Array,
  flags = 0
): Uint8Array {
  const out = new Uint8Array(FRAME_HEADER_SIZE + payload.byteLength);
  out[0] = streamId & 0xff;
  out[1] = type & 0xff;
  out[2] = flags & 0xff;
  out[3] = 0;
  out.set(payload, FRAME_HEADER_SIZE);
  return out;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/** Source d'aléa injectable (expo-crypto sur mobile, `crypto` sous Node). */
export type RandomBytes = (byteLength: number) => Uint8Array;

export function randomHex(byteLength: number, random: RandomBytes): string {
  return Array.from(random(byteLength))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
