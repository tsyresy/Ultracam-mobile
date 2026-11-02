/**
 * Chef d'orchestre de la diffusion.
 *
 * Enchaîne : découverte → connexion de signalisation → authentification →
 * démarrage de l'encodeur natif → canal média. Il expose un état observable
 * consommé par l'interface, sans dépendre de React.
 */

import { DEFAULT_PRO_SETTINGS, ProSettings } from '../protocol/constants';
import {
  CaptureSink,
  EncoderCapabilities,
  NativeEncoder,
  encoderConfigFrom,
  getEncoder,
} from './capture';
import { DiscoveredStudio } from './discovery';
import { Credentials, clearToken, loadToken, saveToken } from './identity';
import { MediaChannel } from '../net/media';
import { SignalConnection } from '../net/connection';
import { WebSocketFactory } from '../net/connection';

export type StreamPhase =
  | 'idle'
  | 'connecting'
  | 'pairing'
  | 'ready'
  | 'streaming'
  | 'error';

export interface StreamingState {
  phase: StreamPhase;
  studio: DiscoveredStudio | null;
  studioName: string | null;
  paired: boolean;
  settings: ProSettings;
  capabilities: EncoderCapabilities | null;
  encoderAvailable: boolean;
  message: string | null;
  stats: { fps: number; bitrateKbps: number; dropped: number };
}

export interface StreamingDeps {
  /** Charge l'identité persistante de l'appareil. */
  loadCredentials: () => Promise<Credentials>;
  /** Fabrique WebSocket injectable (native en prod, `ws` en test). */
  webSocketFactory?: WebSocketFactory;
}

export type StateListener = (state: StreamingState) => void;

export class StreamingController {
  private readonly listeners = new Set<StateListener>();
  private connection: SignalConnection | null = null;
  private media: MediaChannel | null = null;
  private encoder: NativeEncoder | null = null;
  private credentials: Credentials | null = null;
  private frameCounter = 0;
  private byteCounter = 0;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  private state: StreamingState = {
    phase: 'idle',
    studio: null,
    studioName: null,
    paired: false,
    settings: { ...DEFAULT_PRO_SETTINGS },
    capabilities: null,
    encoderAvailable: getEncoder() !== null,
    message: null,
    stats: { fps: 0, bitrateKbps: 0, dropped: 0 },
  };

  constructor(private readonly deps: StreamingDeps) {}

  get current(): StreamingState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private patch(update: Partial<StreamingState>): void {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener(this.state);
  }

  /** Se connecte à un Studio ; `pairingCode` n'est utile qu'au premier appairage. */
  async connect(studio: DiscoveredStudio, pairingCode?: string): Promise<void> {
    await this.disconnect();
    this.patch({ phase: 'connecting', studio, studioName: studio.name, message: null });

    if (!this.credentials) this.credentials = await this.deps.loadCredentials();
    const credentials = this.credentials;
    const token = await loadToken(credentials.deviceId, studio.key);

    const connection = new SignalConnection({
      host: studio.host,
      port: studio.port,
      secure: !studio.plain,
      identity: {
        deviceId: credentials.deviceId,
        deviceName: credentials.deviceName,
        platform: credentials.platform,
      },
      token,
      pairingCode,
      webSocketFactory: this.deps.webSocketFactory,
      events: {
        onWelcome: ({ studioName }) => this.patch({ studioName }),
        onPairingRequired: () => this.patch({ phase: 'pairing' }),
        onAuthenticated: (newToken) => {
          void saveToken(credentials.deviceId, studio.key, newToken).catch(() => undefined);
          this.patch({ phase: 'ready', paired: true, message: null });
        },
        onSettings: (settings) => {
          this.patch({ settings });
          this.encoder?.setOption('lens', settings.lens);
          this.encoder?.setOption('zoom', settings.zoom);
          this.encoder?.setOption('torch', settings.torch);
        },
        onError: (code, message) => this.patch({ phase: 'error', message: `${code} : ${message}` }),
        onClose: () => {
          if (this.state.phase !== 'error') this.patch({ phase: 'idle', paired: false });
        },
      },
    });
    this.connection = connection;
    connection.connect();
  }

  async submitPairingCode(code: string): Promise<void> {
    this.connection?.setPairingCode(code);
  }

  /** Le Studio a refusé le jeton : on le rejoue au prochain appairage. */
  async forgetPairing(): Promise<void> {
    const credentials = this.credentials;
    const studio = this.state.studio;
    if (!credentials || !studio) return;
    await clearToken(credentials.deviceId, studio.key);
    this.patch({ paired: false, phase: 'idle', message: null });
  }

  /** Applique un réglage et le transmet au Studio. */
  async updateSettings(patch: Partial<ProSettings>): Promise<void> {
    const settings = { ...this.state.settings, ...patch };
    this.patch({ settings });
    this.connection?.updateSettings(patch);
    if (patch.lens) this.encoder?.setOption('lens', patch.lens);
    if (patch.zoom !== undefined) this.encoder?.setOption('zoom', patch.zoom);
    if (patch.torch !== undefined) this.encoder?.setOption('torch', patch.torch);
  }

  async startStream(): Promise<void> {
    if (!this.connection || this.state.phase !== 'ready') return;
    const encoder = getEncoder();
    if (!encoder) {
      this.patch({
        phase: 'error',
        message: "Encodeur vidéo natif absent : l'aperçu seul est disponible.",
      });
      return;
    }
    const studio = this.state.studio;
    if (!studio) return;

    const config = encoderConfigFrom(this.state.settings);
    const capabilities = await encoder.configure(config);
    const media = new MediaChannel({
      host: studio.host,
      port: studio.port,
      secure: !studio.plain,
      deviceId: this.connection.deviceId,
      webSocketFactory: this.deps.webSocketFactory,
      onError: (message) => this.patch({ message }),
    });

    const sink: CaptureSink = {
      onVideoConfig: (spssPps) => media.sendVideoConfig(spssPps),
      onVideoFrame: ({ data, keyframe }) => {
        media.sendVideo(data, keyframe);
        this.frameCounter += 1;
        this.byteCounter += data.byteLength;
      },
      onAudioConfig: (config2) => media.sendAudioConfig(config2),
      onAudioFrame: ({ data }) => media.sendAudio(data),
      onStats: ({ dropped }) =>
        this.patch({ stats: { ...this.state.stats, dropped } }),
    };

    media.open();
    this.media = media;
    this.encoder = encoder;
    this.connection.startStream();
    this.connection.publishSettingsState();
    await encoder.start(sink);
    this.startStatsLoop();
    this.patch({ phase: 'streaming', capabilities });
  }

  async stopStream(): Promise<void> {
    this.stopStatsLoop();
    try {
      await this.encoder?.stop();
    } catch {
      /* ignoré */
    }
    this.media?.close();
    this.connection?.stopStream();
    this.encoder = null;
    this.media = null;
    this.patch({ phase: this.connection ? 'ready' : 'idle', stats: { fps: 0, bitrateKbps: 0, dropped: 0 } });
  }

  async disconnect(): Promise<void> {
    this.stopStatsLoop();
    try {
      await this.encoder?.stop();
    } catch {
      /* ignoré */
    }
    this.media?.close();
    this.connection?.close();
    this.encoder = null;
    this.media = null;
    this.connection = null;
    this.patch({ phase: 'idle', paired: false });
  }

  private startStatsLoop(): void {
    this.stopStatsLoop();
    this.frameCounter = 0;
    this.byteCounter = 0;
    this.statsTimer = setInterval(() => {
      this.patch({
        stats: {
          ...this.state.stats,
          fps: this.frameCounter,
          bitrateKbps: Math.round((this.byteCounter * 8) / 1000),
        },
      });
      this.frameCounter = 0;
      this.byteCounter = 0;
    }, 1000);
  }

  private stopStatsLoop(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }
}
