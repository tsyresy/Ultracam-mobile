# Ultracam Mobile (Expo — iOS + Android)

Application hybride qui transforme le téléphone en **caméra distante** pour
`../UltraCamStudio`. Elle capture, encode, et diffuse vers le Studio sur un
WebSocket binaire. Implémentation originale : elle parle uniquement le protocole
ouvert **Ultracam v1** (voir `src/protocol/constants.ts`, miroir de
`../UltraCamStudio/src/protocol.ts`).

---

## Démarrage

```bash
cd UtracamMobile
npm install

npm start                 # Metro / Expo Go
npm run android           # build natif + lancement (expo run:android)
npm run ios               # build natif + lancement (expo run:ios)
```

> `expo run:*` nécessite Android SDK / Xcode. Absents sur la machine de build :
> les écrans, l'appairage, la découverte et les réglages Pro ont été validés par
> typecheck + test d'intégration, mais pas par un run natif.

Si le module natif `UltracamEncoder` n'est pas compilé (cas d'Expo Go), l'app
bascule en **aperçu seul** : la caméra s'affiche, tous les écrans fonctionnent,
seul « Démarrer la diffusion » est désactivé.

---

## Écrans (`app/`, expo-router)

| route | rôle |
|---|---|
| `index.tsx` | accueil : liste des Studios découverts (mDNS + ajout manuel d'IP), état de connexion |
| `connect.tsx` | connexion manuelle à un hôte/port, choix sécurisé/clair |
| `pair.tsx` | saisie du code d'appairage à 6 chiffres, mémorisation du jeton |
| `stream.tsx` | aperçu caméra (`expo-camera`), démarrage/arrêt de la diffusion |
| `pro.tsx` | **Réglages Pro** : 26 réglages en 5 sections (Optique, Image, Encodage vidéo, Audio, Presets), appliqués en direct |

---

## Réglages Pro (parité avec le desktop)

Les mêmes 26 réglages que le Studio, éditables **des deux côtés** :

| section | réglages |
|---|---|
| Image | `lens`, `zoom`, `torch`, `focus`, `whiteBalance`, `exposureCompensation` |
| Couleurs | `brightness`, `contrast`, `saturation`, `gamma`, `sharpness`, `hue`, `preset` |
| Traitement | `hdr`, `stabilization`, `mirror`, `beauty`, `cleanFrame` |
| Vidéo | `resolution.width`, `resolution.height`, `fps`, `bitrateKbps`, `codec` |
| Audio | `audioEnabled`, `audioCodec`, `audioBitrateKbps` |

Flux de synchronisation :

- **Téléphone → Studio** : `settings-state` (état complet) puis `settings`
  (patch) à chaque changement.
- **Studio → Téléphone** : message `settings`, fusionné localement par
  `SignalConnection.onMessage` puis appliqué à l'aperçu (`facing`) et à
  l'encodeur natif (`setOption`).
- Le `lens` est partagé : `'back'` (défaut) ou `'front'`, directement mappé sur
  `CameraView facing`.

Les réglages sont persistés (AsyncStorage) et republiés à la reconnexion.

---

## Architecture `src/`

```
protocol/constants.ts   PROTOCOL_VERSION, SignalType, MediaFrameType, ProSettings
net/connection.ts       SignalConnection : hello → welcome → authenticate → authenticated
net/media.ts            MediaChannel : trames binaires [streamId|type|flags|0|payload]
services/discovery.ts   StudioDiscovery (react-native-zeroconf + ajout manuel)
services/identity.ts    deviceId stable (expo-crypto + expo-device)
services/preferences.ts jetons + réglages persistés (AsyncStorage)
services/streaming.ts   contrôleur singleton : connexion + encodeur + réglages
services/capture.ts     contrat CaptureSink / EncoderConfig / registerEncoderProvider
services/encoderBridge.ts pont vers NativeModules.UltracamEncoder (base64 → Uint8Array)
hooks/useStreaming.ts   accès React au contrôleur (abonnement, état)
components/             ui.tsx (Screen/Card/Button/…), SliderField.tsx
theme.ts                palette et espacements
```

### Découverte

- mDNS `_ultracam._tcp` via `react-native-zeroconf`.
- Repli : ajout manuel `hôte:port` depuis `index.tsx` (utile si le mDNS est
  filtré par le réseau).

### Transport

- Signal : `ws(s)://<studio>:47900/signal`, sous-protocole `ultracam.signal.v1`,
  JSON texte. Délai de poignée de main : 12 s.
- Média : `ws(s)://<studio>:47900/media?deviceId=…`, sous-protocole
  `ultracam.media.v1`. L'autorisation est héritée de la session `/signal`
  (5 minutes) : il faut s'authentifier **avant** d'ouvrir `/media`.

---

## Contrat de l'encodeur natif

`NativeModules.UltracamEncoder` doit exposer :

```ts
configure(config: EncoderConfig): Promise<EncoderCapabilities>
start(): Promise<void>
stop(): Promise<void>
setOption(name: string, value: string | number | boolean): void
```

et émettre, sous le nom `ultracam`, des événements `{ event, payload }` de type
`config` (SPS/PPS ou config audio), `frame` (base64 + `keyframe` + `ptsMicros`) et
`stats`. Détails et notes d'implémentation Android (MediaCodec) / iOS
(VideoToolbox) : `modules/ultracam-encoder/README.md`.

`registerNativeEncoder()` (`src/services/encoderBridge.ts`) détecte le module au
démarrage et n'enregistre le fournisseur que s'il est présent.

---

## Tests

```bash
# Typecheck (nécessite un node_modules installé)
npm run typecheck

# Intégration réseau contre un Studio réel
PAIRING_CODE=<code> node scripts/test-connection.js
#   → MOBILE_TEST_OK
```

`scripts/test-connection.js` compile `src/net` + `src/protocol` avec esbuild puis
exécute la séquence complète : connexion, appairage, `stream-start`, envoi de
config + keyframe + delta, `settings`. Sortie attendue :

```
[mobile] Studio : <nom>
[mobile] Authentifié auprès du Studio
[mobile] média envoyé { bytes: 36, frames: 3 }
MOBILE_TEST_OK
```

---

## Types

`types/react-native-zeroconf.d.ts` déclare l'API utilisée de
`react-native-zeroconf` 0.13 (le paquet n'en fournit pas).
