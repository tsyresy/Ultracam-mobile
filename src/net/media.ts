/**
 * Canal média Ultracam (`/media`).
 *
 * Chaque message WebSocket binaire contient une trame Ultracam :
 *   [streamId (1) | type (1) | flags (1) | réservé (1) | payload…]
 *
 * Les NAL encodés par le téléphone y sont encapsulés tels quels ; le Studio
 * reconstruit le flux H.264/HEVC complet en concaténant les payloads.
 */

import {
  AUDIO_STREAM_ID,
  MediaFrameType,
  VIDEO_STREAM_ID,
  WS_SUBPROTOCOL_MEDIA,
  encodeMediaFrame,
} from '../protocol/constants';
import { WebSocketFactory, WebSocketLike, WS_OPEN } from './connection';

export interface MediaChannelOptions {
  host: string;
  port: number;
  secure?: boolean;
  /**
   * Identité de l'appareil déjà authentifiée sur `/signal`. Le Studio hérite
   * de cette authentification pour le canal média (`?deviceId=…`).
   */
  deviceId: string;
  webSocketFactory?: WebSocketFactory;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
}

/**
 * Diffuseur de média.
 *
 * Le Studio exige que le pair soit authentifié : la session de signalisation
 * est donc établie **avant** l'ouverture du canal média.
 */
export class MediaChannel {
  private socket: WebSocketLike | null = null;
  private readonly queue: Uint8Array[] = [];
  private disposed = false;
  private bytesSent = 0;
  private framesSent = 0;

  constructor(private readonly opts: MediaChannelOptions) {}

  get stats(): { bytes: number; frames: number } {
    return { bytes: this.bytesSent, frames: this.framesSent };
  }

  get isOpen(): boolean {
    return this.socket?.readyState === WS_OPEN;
  }

  open(): void {
    if (this.socket || this.disposed) return;
    const scheme = this.opts.secure === false ? 'ws' : 'wss';
    const deviceId = encodeURIComponent(this.opts.deviceId);
    const url = `${scheme}://${this.opts.host}:${this.opts.port}/media?deviceId=${deviceId}`;
    const factory = this.opts.webSocketFactory ?? defaultWebSocketFactory;
    const socket = factory(url, [WS_SUBPROTOCOL_MEDIA]);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => {
      this.flushQueue();
      this.opts.onOpen?.();
    };
    socket.onclose = () => {
      this.socket = null;
      this.opts.onClose?.();
    };
    socket.onerror = () => this.opts.onError?.('Canal média en erreur');
    socket.onmessage = () => undefined;
  }

  sendVideoConfig(spsPps: Uint8Array): void {
    this.enqueue(VIDEO_STREAM_ID, MediaFrameType.Config, spsPps);
  }

  /** Envoie une image encodée ; `keyframe` doit être vrai au premier IDR. */
  sendVideo(frame: Uint8Array, keyframe: boolean): void {
    this.enqueue(
      VIDEO_STREAM_ID,
      keyframe ? MediaFrameType.KeyFrame : MediaFrameType.DeltaFrame,
      frame
    );
  }

  sendAudioConfig(config: Uint8Array): void {
    this.enqueue(AUDIO_STREAM_ID, MediaFrameType.AudioConfig, config);
  }

  sendAudio(frame: Uint8Array): void {
    this.enqueue(AUDIO_STREAM_ID, MediaFrameType.AudioFrame, frame);
  }

  close(): void {
    this.disposed = true;
    this.queue.length = 0;
    if (this.socket) {
      try {
        this.socket.close(1000, 'done');
      } catch {
        /* ignoré */
      }
      this.socket = null;
    }
  }

  private enqueue(streamId: number, type: MediaFrameType, payload: Uint8Array): void {
    if (this.disposed) return;
    const framed = encodeMediaFrame(streamId, type, payload);
    if (!this.isOpen) {
      this.queue.push(framed);
      return;
    }
    this.write(framed);
  }

  private flushQueue(): void {
    const queued = this.queue.splice(0);
    for (const frame of queued) this.write(frame);
  }

  private write(frame: Uint8Array): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WS_OPEN) return;
    try {
      socket.send(frame);
      this.bytesSent += frame.byteLength;
      this.framesSent += 1;
    } catch (err) {
      this.opts.onError?.(`Envoi média impossible : ${(err as Error).message}`);
    }
  }
}

function defaultWebSocketFactory(url: string, protocols: string[]): WebSocketLike {
  const Ctor = (
    globalThis as unknown as { WebSocket?: new (url: string, protocols?: string[]) => WebSocketLike }
  ).WebSocket;
  if (!Ctor) throw new Error('Aucune implémentation WebSocket disponible sur cette plateforme.');
  return new Ctor(url, protocols);
}
