/**
 * Identité de l'appareil et stockage persistant du jeton d'appairage.
 *
 * L'identifiant est stable mais non secret ; seul le jeton (opaque, 32 octets)
 * doit rester confidentiel. AsyncStorage suffit pour le jeton sur un appareil
 * non compromis, mais `expo-secure-store` est préférable côté production : le
 * module ci-dessous isole donc tous les accès au stockage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const KEY_DEVICE_ID = 'ultracam.deviceId';
const KEY_DEVICE_NAME = 'ultracam.deviceName';
const TOKEN_PREFIX = 'ultracam.token.';

export interface StoredIdentity {
  deviceId: string;
  deviceName: string;
}

/** Identité complète utilisée par le contrôleur de diffusion. */
export interface Credentials extends StoredIdentity {
  platform: 'ios' | 'android' | 'web';
}

function platformName(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export function currentPlatform(): 'ios' | 'android' | 'web' {
  return platformName();
}

/** Charge (ou crée) l'identité persistante de l'appareil. */
export async function loadOrCreateIdentity(): Promise<Credentials> {
  const savedId = await AsyncStorage.getItem(KEY_DEVICE_ID);
  let deviceName = (await AsyncStorage.getItem(KEY_DEVICE_NAME)) ?? '';
  if (!deviceName) {
    deviceName = Device.deviceName ?? `${platformName() === 'ios' ? 'iPhone' : 'Téléphone'} Ultracam`;
    await AsyncStorage.setItem(KEY_DEVICE_NAME, deviceName);
  }
  if (savedId) return { deviceId: savedId, deviceName, platform: platformName() };

  const bytes = Crypto.getRandomBytes(16);
  const deviceId = 'uc-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  await AsyncStorage.setItem(KEY_DEVICE_ID, deviceId);
  return { deviceId, deviceName, platform: platformName() };
}

/** Clé de stockage du jeton pour un Studio donné. */
function tokenKey(deviceId: string, studioKey: string): string {
  return `${TOKEN_PREFIX}${deviceId}.${studioKey}`;
}

export async function loadToken(deviceId: string, studioKey: string): Promise<string | null> {
  return AsyncStorage.getItem(tokenKey(deviceId, studioKey));
}

export async function saveToken(
  deviceId: string,
  studioKey: string,
  token: string
): Promise<void> {
  await AsyncStorage.setItem(tokenKey(deviceId, studioKey), token);
}

export async function clearToken(deviceId: string, studioKey: string): Promise<void> {
  await AsyncStorage.removeItem(tokenKey(deviceId, studioKey));
}
