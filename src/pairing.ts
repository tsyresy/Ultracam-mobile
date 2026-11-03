/** Studio protocol v1: explicit WebSocket endpoint and a 256-bit hexadecimal secret.
 * Deliberately avoids React Native 0.76's incomplete URL/URLSearchParams polyfill.
 */
export function parsePairing(value: string): string {
 const text = value.trim();
 const match = /^(wss?):\/\/([a-zA-Z0-9.-]+):(\d{1,5})\/stream\?token=([a-fA-F0-9]{64})$/.exec(text);
 if (!match || Number(match[3]) < 1 || Number(match[3]) > 65535) throw new Error('Invalid pairing endpoint');
 if (/^[0-9.]+$/.test(match[2]) && (match[2].split('.').length !== 4 || match[2].split('.').some(part => !part || Number(part) > 255))) throw new Error('Invalid IPv4 address');
 return text;
}

export type Transport = 'wifi' | 'usb';
/** ADB reverse terminates on the phone's loopback interface; retain the secret. */
export function pairingForTransport(value: string, transport: Transport): string {
 const endpoint = parsePairing(value);
 if (transport === 'wifi') return endpoint;
 if (!endpoint.startsWith('ws://') || !endpoint.includes(':49721/stream?')) {
  throw new Error('USB requires the Studio local endpoint on port 49721');
 }
 return endpoint.replace(/^ws:\/\/[^:]+:/, 'ws://127.0.0.1:');
}
