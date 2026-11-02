/**
 * Client de signalisation Ultracam côté mobile.
 *
 * Le téléphone est **toujours** le client : il ouvre une WebSocket vers
 * `wss://<studio>/signal`, réalise la poignée de main JSON
 * (hello → welcome → authenticate → authenticated) puis peut ouvrir une
 * seconde WebSocket `/media` pour diffuser les trames encodées.
 *
 * Le transport WebSocket est injecté (`WebSocketFactory`) afin de rester
 * testable sous Node et de fonctionner sur iOS/Android via la WebSocket
 * native de React Native.
 */

import {
  DEFAULT_PRO_SETTINGS,
  IncomingSignal,
  PROTOCOL_VERSION,
  ProSettings,
  SettingsStateMessage,
  SignalType,
  WS_SUBPROTOCOL_SIGNAL,
} from '../protocol/constants';

/**
 * `TextDecoder` existe dans Hermes/JavaScriptCore mais n'est pas exposé par la
 * bibliothèque DOM : on le déclare ici pour typer l'accès.
 */
declare const TextDecoder: { new (label?: string): { decode(input?: Uint8Array): string } };

/** Sous-ensemble de `WebSocket` dont le client a besoin. */
export interface WebSocketLike {
  binaryType: string;
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  send(data: string | ArrayBuffer | Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export const WS_OPEN = 1;

export type WebSocketFactory = (url: string, protocols: string[]) => WebSocketLike;

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
}

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'hello'
  | 'pairing'
  | 'authenticated'
  | 'closed'
  | 'error';

export interface ConnectionEvents {
  onState?: (state: ConnectionState) => void;
  onWelcome?: (info: { studioName: string; authenticated: boolean }) => void;
  /** Le Studio exige un code d'appairage (inconnu ou jeton refusé). */
  onPairingRequired?: () => void;
  onAuthenticated?: (token: string) => void;
  onSettings?: (settings: ProSettings) => void;
  onError?: (code: string, message: string) => void;
  onClose?: () => void;
  onLog?: (message: string) => void;
}

export interface ConnectionOptions {
  /** Hôte ou adresse IP du Studio. */
  host: string;
  port: number;
  identity: DeviceIdentity;
  /** Jeton persistant du dernier appairage réussi. */
  token?: string | null;
  /** Code à 6 chiffres fourni par l'utilisateur. */
  pairingCode?: string | null;
  secure?: boolean;
  events?: ConnectionEvents;
  /** Injecté pour les tests ; par défaut `globalThis.WebSocket`. */
  webSocketFactory?: WebSocketFactory;
  /** Délai avant l'abandon de la poignée de main, en ms. */
  handshakeTimeoutMs?: number;
}

function defaultWebSocketFactory(url: string, protocols: string[]): WebSocketLike {
  const Ctor = (
    globalThis as unknown as { WebSocket?: new (url: string, protocols?: string[]) => WebSocketLike }
  ).WebSocket;
  if (!Ctor) throw new Error('Aucune implémentation WebSocket disponible sur cette plateforme.');
  return new Ctor(url, protocols);
}

function mergeSettings(base: ProSettings, patch: Partial<ProSettings>): ProSettings {
  return {
    ...base,
    ...patch,
    resolution: patch.resolution ? { ...patch.resolution } : { ...base.resolution },
  };
}

/**
 * Connexion de signalisation authentifiée.
 *
 * Cycle de vie :
 *   connect() → hello → welcome → authenticate → authenticated
 *
 * Tant que l'appairage n'est pas terminé, `setPairingCode()` permet de le
 * fournir après coup (l'utilisateur lit le code sur l'écran du Studio).
 */
export class SignalConnection {
  private socket: WebSocketLike | null = null;
  private state: ConnectionState = 'idle';
  private token: string | null;
  private pairingCode: string | null;
  private settings: ProSettings = { ...DEFAULT_PRO_SETTINGS };
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly opts: ConnectionOptions) {
    this.token = opts.token ?? null;
    this.pairingCode = opts.pairingCode ?? null;
  }

  get currentState(): ConnectionState {
    return this.state;
  }

  get currentSettings(): ProSettings {
    return this.settings;
  }

  get authToken(): string | null {
    return this.token;
  }

  get deviceId(): string {
    return this.opts.identity.deviceId;
  }

  baseUrl(): string {
    const scheme = this.opts.secure === false ? 'ws' : 'wss';
    return `${scheme}://${this.opts.host}:${this.opts.port}`;
  }

  connect(): void {
    if (this.socket || this.disposed) return;
    this.setState('connecting');
    let socket: WebSocketLike;
    try {
      const factory = this.opts.webSocketFactory ?? defaultWebSocketFactory;
      socket = factory(`${this.baseUrl()}/signal`, [WS_SUBPROTOCOL_SIGNAL]);
    } catch (err) {
      this.fail('websocket_unavailable', (err as Error).message);
      return;
    }
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => this.sendHello();
    socket.onmessage = (event) => this.onMessage(event.data);
    socket.onerror = () => this.log('Erreur WebSocket');
    socket.onclose = (event) => {
      this.log(`Connexion fermée (${event.code})`);
      this.clearHandshakeTimer();
      this.socket = null;
      if (this.state !== 'error') this.setState('closed');
      this.opts.events?.onClose?.();
    };
    this.armHandshakeTimer();
  }

  /** Fournit le code d'appairage et rejoue l'authentification. */
  setPairingCode(code: string): void {
    this.pairingCode = code.replace(/\s+/g, '');
    this.sendAuthenticate();
  }

  /** Remplace le jeton (par exemple après rotation côté Studio). */
  setToken(token: string | null): void {
    this.token = token;
  }

  /** Envoie une modification de réglage partielle au Studio. */
  updateSettings(patch: Partial<ProSettings>): void {
    this.settings = mergeSettings(this.settings, patch);
    this.sendJson({ type: SignalType.Settings, settings: patch });
  }

  /** Publie l'état complet (reçu du Studio, ou restauré depuis le stockage). */
  publishSettingsState(): void {
    const message: SettingsStateMessage = {
      type: SignalType.SettingsState,
      settings: this.settings,
    };
    this.sendJson(message);
  }

  /** Démarre un flux vidéo avec les réglages courants. */
  startStream(): void {
    this.sendJson({
      type: SignalType.StreamStart,
      video: {
        codec: this.settings.codec,
        width: this.settings.resolution.width,
        height: this.settings.resolution.height,
        fps: this.settings.fps,
        bitrate: this.settings.bitrateKbps * 1000,
      },
      audio: this.settings.audioEnabled
        ? {
            codec: this.settings.audioCodec,
            sampleRate: 48000,
            channels: 1,
            bitrate: this.settings.audioBitrateKbps * 1000,
          }
        : undefined,
    });
  }

  stopStream(): void {
    this.sendJson({ type: SignalType.StreamStop });
  }

  close(): void {
    this.disposed = true;
    this.clearHandshakeTimer();
    if (this.socket) {
      try {
        this.socket.close(1000, 'bye');
      } catch {
        /* ignoré */
      }
      this.socket = null;
    }
    this.setState('closed');
  }

  private sendHello(): void {
    this.setState('hello');
    this.sendJson({
      type: SignalType.Hello,
      protocol: PROTOCOL_VERSION,
      deviceName: this.opts.identity.deviceName,
      platform: this.opts.identity.platform,
      deviceId: this.opts.identity.deviceId,
    });
  }

  private sendAuthenticate(): void {
    if (!this.socket || this.socket.readyState !== WS_OPEN) return;
    this.sendJson({
      type: SignalType.Authenticate,
      deviceId: this.opts.identity.deviceId,
      token: this.token ?? undefined,
      pairingCode: this.pairingCode ?? undefined,
    });
  }

  private onMessage(raw: unknown): void {
    let text: string;
    if (typeof raw === 'string') text = raw;
    else if (raw instanceof ArrayBuffer) text = new TextDecoder().decode(new Uint8Array(raw));
    else if (ArrayBuffer.isView(raw)) text = new TextDecoder().decode(raw as Uint8Array);
    else return;

    let msg: IncomingSignal;
    try {
      msg = JSON.parse(text) as IncomingSignal;
    } catch {
      this.log(`Message illisible : ${text.slice(0, 80)}`);
      return;
    }
    if (typeof msg?.type !== 'string') return;

    switch (msg.type) {
      case SignalType.Welcome:
        this.log(`Studio : ${msg.studioName}`);
        this.opts.events?.onWelcome?.({
          studioName: msg.studioName,
          authenticated: msg.authenticated,
        });
        this.sendAuthenticate();
        break;
      case SignalType.Authenticated:
        this.token = msg.token;
        this.clearHandshakeTimer();
        this.setState('authenticated');
        this.log('Authentifié auprès du Studio');
        this.opts.events?.onAuthenticated?.(msg.token);
        break;
      case SignalType.PairingRequired:
        this.setState('pairing');
        this.log('Code d\u2019appairage requis');
        this.opts.events?.onPairingRequired?.();
        break;
      case SignalType.Settings:
        this.settings = mergeSettings(this.settings, msg.settings);
        this.opts.events?.onSettings?.(this.settings);
        break;
      case SignalType.Error:
        this.fail(msg.code, msg.message);
        break;
      case SignalType.Pong:
        break;
      default:
        break;
    }
  }

  private sendJson(message: unknown): void {
    if (!this.socket || this.socket.readyState !== WS_OPEN) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      this.log(`Envoi impossible : ${(err as Error).message}`);
    }
  }

  private fail(code: string, message: string): void {
    this.clearHandshakeTimer();
    this.setState('error');
    this.log(`Erreur Studio : ${code} — ${message}`);
    this.opts.events?.onError?.(code, message);
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.opts.events?.onState?.(state);
  }

  private log(message: string): void {
    this.opts.events?.onLog?.(message);
  }

  private armHandshakeTimer(): void {
    this.clearHandshakeTimer();
    const timeout = this.opts.handshakeTimeoutMs ?? 12_000;
    this.handshakeTimer = setTimeout(() => {
      if (this.state !== 'authenticated') {
        this.fail('handshake_timeout', 'Le Studio ne répond pas.');
        try {
          this.socket?.close(1000, 'timeout');
        } catch {
          /* ignoré */
        }
      }
    }, timeout);
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }
}

function isSettingsState(msg: unknown): msg is SettingsStateMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: unknown }).type === SignalType.SettingsState
  );
}

/** Utilitaire exporté pour les tests unitaires. */
export function parseSettingsState(text: string): ProSettings | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isSettingsState(parsed) ? mergeSettings(DEFAULT_PRO_SETTINGS, parsed.settings) : null;
  } catch {
    return null;
  }
}
