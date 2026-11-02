/**
 * Découverte des studios Ultracam sur le réseau local (mDNS/Bonjour).
 *
 * Le Studio annonce un service `_ultracam._tcp` ; les TXT records portent la
 * version du protocole, le nom convivial et l'empreinte du certificat TLS.
 */

import Zeroconf, { Service } from 'react-native-zeroconf';
import { DEFAULT_PORT, PROTOCOL_VERSION, SERVICE_TYPE } from '../protocol/constants';

export interface DiscoveredStudio {
  /** Identifiant stable : `hôte:port`. */
  key: string;
  name: string;
  host: string;
  port: number;
  protocol: number;
  fingerprint?: string;
  /** Le Studio accepte aussi le HTTP en clair (développement). */
  plain: boolean;
}

export interface DiscoveryOptions {
  onChange: (studios: DiscoveredStudio[]) => void;
  onError?: (message: string) => void;
}

/** Résout l'adresse IPv4 du premier enregistrement A du service. */
function lookupHost(service: Service): string | null {
  const addresses = service.addresses ?? [];
  const ipv4 = addresses.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  return ipv4 ?? addresses[0] ?? service.host ?? null;
}

function hostToKey(host: string): string {
  return host.replace(/\.$/, '');
}

export class StudioDiscovery {
  private readonly zeroconf = new Zeroconf();
  private readonly studios = new Map<string, DiscoveredStudio>();
  private started = false;

  constructor(private readonly opts: DiscoveryOptions) {}

  start(): void {
    if (this.started) return;
    this.started = true;

    this.zeroconf.on('resolved', (service: Service) => {
      const host = lookupHost(service);
      if (!host) return;
      const protocol = Number(service.txt?.protocol ?? PROTOCOL_VERSION);
      if (Number.isFinite(protocol) && protocol !== PROTOCOL_VERSION) return;
      const port = service.port || DEFAULT_PORT;
      const key = `${hostToKey(host)}:${port}`;
      this.studios.set(key, {
        key,
        name: String(service.txt?.name ?? service.name ?? host),
        host: hostToKey(host),
        port,
        protocol,
        fingerprint: service.txt?.fingerprint ? String(service.txt.fingerprint) : undefined,
        plain: service.txt?.plain === '1',
      });
      this.emit();
    });

    this.zeroconf.on('remove', (service: Service) => {
      const host = lookupHost(service);
      if (!host) return;
      this.studios.delete(`${hostToKey(host)}:${service.port || DEFAULT_PORT}`);
      this.emit();
    });

    this.zeroconf.on('error', (err: unknown) => {
      this.opts.onError?.(err instanceof Error ? err.message : String(err));
    });

    this.zeroconf.scan(SERVICE_TYPE, 'tcp', 'local.');
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.zeroconf.stop();
    this.zeroconf.removeAllListeners();
    this.studios.clear();
    this.emit();
  }

  /** Enregistre un Studio saisi manuellement (hors mDNS). */
  addManual(host: string, port = DEFAULT_PORT, name?: string): DiscoveredStudio {
    const key = `${host}:${port}`;
    const studio: DiscoveredStudio = {
      key,
      name: name ?? host,
      host,
      port,
      protocol: PROTOCOL_VERSION,
      plain: false,
    };
    this.studios.set(key, studio);
    this.emit();
    return studio;
  }

  get list(): DiscoveredStudio[] {
    return Array.from(this.studios.values());
  }

  private emit(): void {
    this.opts.onChange(this.list);
  }
}
