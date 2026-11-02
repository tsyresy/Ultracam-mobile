/**
 * Déclarations TypeScript de `react-native-zeroconf` (le paquet n'en fournit
 * pas en version 0.13). Seule la surface utilisée par Ultracam est décrite.
 */

declare module 'react-native-zeroconf' {
  export interface Service {
    name: string;
    host: string;
    port: number;
    addresses?: string[];
    txt?: Record<string, string>;
    fullName?: string;
  }

  type Events = {
    start: () => void;
    stop: () => void;
    resolved: (service: Service) => void;
    remove: (service: Service) => void;
    error: (error: unknown) => void;
    published: (service: Service) => void;
    found: (service: Service) => void;
  };

  export default class Zeroconf {
    on<K extends keyof Events>(event: K, listener: Events[K]): void;
    removeAllListeners(): void;
    scan(type: string, protocol?: string, domain?: string): void;
    stop(): void;
    getServices(): Service[];
  }
}
