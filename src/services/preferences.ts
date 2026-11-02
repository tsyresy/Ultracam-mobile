/**
 * Réglages du Studio saisis « à la main » (hors mDNS) et préférences de
 * diffusion locales à l'appareil.
 *
 * Les réglages Pro, eux, vivent dans `StreamingController` : ils sont toujours
 * rechargés depuis le Studio pour que les deux applications restent alignées.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PORT, PROTOCOL_VERSION } from '../protocol/constants';
import { DiscoveredStudio } from './discovery';

const KEY_MANUAL_STUDIOS = 'ultracam.manualStudios';

export interface ManualStudioEntry {
  host: string;
  port: number;
  name?: string;
}

export async function loadManualStudios(): Promise<ManualStudioEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_MANUAL_STUDIOS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ManualStudioEntry => {
        if (typeof entry !== 'object' || entry === null) return false;
        const value = entry as Record<string, unknown>;
        return typeof value.host === 'string' && value.host.length > 0;
      })
      .map((entry) => ({
        host: entry.host,
        port: Number.isFinite(entry.port) ? entry.port : DEFAULT_PORT,
        name: entry.name,
      }));
  } catch {
    return [];
  }
}

export async function saveManualStudio(entry: ManualStudioEntry): Promise<void> {
  const existing = await loadManualStudios();
  const next = existing.filter((item) => `${item.host}:${item.port}` !== `${entry.host}:${entry.port}`);
  next.push(entry);
  await AsyncStorage.setItem(KEY_MANUAL_STUDIOS, JSON.stringify(next.slice(-8)));
}

export async function forgetManualStudio(entry: ManualStudioEntry): Promise<void> {
  const existing = await loadManualStudios();
  const next = existing.filter(
    (item) => `${item.host}:${item.port}` !== `${entry.host}:${entry.port}`
  );
  await AsyncStorage.setItem(KEY_MANUAL_STUDIOS, JSON.stringify(next));
}

/** Reconstruit un Studio découvrable à partir d'une entrée manuelle. */
export function manualToStudio(entry: ManualStudioEntry): DiscoveredStudio {
  return {
    key: `${entry.host}:${entry.port}`,
    name: entry.name ?? entry.host,
    host: entry.host,
    port: entry.port,
    protocol: PROTOCOL_VERSION,
    plain: false,
  };
}
