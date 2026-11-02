/**
 * Test d'intégration du client mobile contre un Ultracam Studio réel.
 *
 * Compile `src/net` et `src/protocol` avec esbuild puis exécute :
 *   connect → hello → welcome → authenticate → authenticated
 *   → réglages → stream-start → trames média (config + keyframe + delta)
 *
 * Usage :
 *   PAIRING_CODE=123456 node scripts/test-connection.js
 *   ULTRACAM_URL=wss://192.168.1.20:47900 node scripts/test-connection.js
 */

const path = require('path');
const esbuild = require("/tmp/ucmobile-test/node_modules/esbuild");

const ROOT = path.resolve(__dirname, '..');
/** Les sorties reproduisent l'arborescence de `src/` pour préserver les imports relatifs. */
const OUT = path.join(ROOT, 'src', '.test-build');

function bundle() {
  esbuild.buildSync({
    entryPoints: [
      path.join(ROOT, 'src/net/connection.ts'),
      path.join(ROOT, 'src/net/media.ts'),
      path.join(ROOT, 'src/protocol/constants.ts'),
    ],
    outdir: OUT,
    bundle: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    loader: { '.ts': 'ts' },
    logLevel: 'error',
  });
}

function run() {
  bundle();
  const WebSocket = require("/tmp/ucmobile-test/node_modules/ws");
  const { SignalConnection } = require(path.join(OUT, 'net', 'connection.js'));
  const { MediaChannel } = require(path.join(OUT, 'net', 'media.js'));

  const url = process.env.ULTRACAM_URL || 'wss://localhost:47900';
  const parsed = new URL(url);
  const pairingCode = process.env.PAIRING_CODE;

  const factory = (target, protocols) =>
    new WebSocket(target, protocols, { rejectUnauthorized: false });

  return new Promise((resolve, reject) => {
    let media = null;
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      try {
        media && media.close();
      } catch {}
      try {
        conn.close();
      } catch {}
      err ? reject(err) : resolve();
    };

    const conn = new SignalConnection({
      host: parsed.hostname,
      port: Number(parsed.port || 47900),
      secure: parsed.protocol !== 'ws:',
      identity: {
        deviceId: 'mobile-test-' + Date.now(),
        deviceName: 'MobileTest',
        platform: 'android',
      },
      token: null,
      pairingCode,
      webSocketFactory: factory,
      events: {
        onLog: (m) => console.log('[mobile]', m),
        onPairingRequired: () => {
          if (!pairingCode) {
            console.error('[mobile] code d\u2019appairage manquant');
            finish(new Error('pairing required'));
          }
        },
        onAuthenticated: (token) => {
          console.log('[mobile] token', token.slice(0, 10) + '\u2026');
          conn.startStream();
          media = new MediaChannel({
            host: parsed.hostname,
            port: Number(parsed.port || 47900),
            secure: parsed.protocol !== 'ws:',
            deviceId: conn.deviceId,
            webSocketFactory: factory,
            onOpen: () => {
              media.sendVideoConfig(new Uint8Array([0, 0, 0, 1, 0x67, 0x42, 0, 0x1e]));
              media.sendVideo(new Uint8Array([0, 0, 0, 1, 0x65, 1, 2, 3]), true);
              media.sendVideo(new Uint8Array([0, 0, 0, 1, 0x41, 4, 5, 6]), false);
              conn.updateSettings({ zoom: 1.5, preset: 'cinema' });
              setTimeout(() => {
                console.log('[mobile] média envoyé', media.stats);
                finish(null);
              }, 400);
            },
            onError: (m) => console.error('[mobile] media:', m),
          });
          media.open();
        },
        onError: (code, message) => finish(new Error(`${code}: ${message}`)),
        onClose: () => console.log('[mobile] signal fermé'),
      },
    });

    setTimeout(() => finish(new Error('timeout global')), 15000);
    conn.connect();
  });
}

run()
  .then(() => {
    console.log('MOBILE_TEST_OK');
    process.exit(0);
  })
  .catch((err) => {
    console.error('MOBILE_TEST_FAIL', err.message);
    process.exit(1);
  });
