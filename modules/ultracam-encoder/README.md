# Module natif `UltracamEncoder`

Encodeur vidéo/audio matériel utilisé par Ultracam Mobile pour diffuser vers
Ultracam Studio. Il expose exactement le contrat décrit dans
`src/services/capture.ts` et est branché par `src/services/encoderBridge.ts`.

> **Statut :** contrat + squelette. Le code natif doit être compilé avec
> `expo run:android` / `expo run:ios`. Tant qu'il n'est pas présent,
> l'application fonctionne en mode **aperçu seul** (le bouton « Démarrer la
> diffusion » est désactivé mais tous les écrans, l'appairage et les réglages
> Pro restent opérationnels).

## API JavaScript

```ts
NativeModules.UltracamEncoder.configure(config: EncoderConfig): Promise<EncoderCapabilities>
NativeModules.UltracamEncoder.start(): Promise<void>
NativeModules.UltracamEncoder.stop(): Promise<void>
NativeModules.UltracamEncoder.setOption(name: string, value: string | number | boolean): void
```

`EncoderConfig` : `{ width, height, fps, bitrate, codec, lens, microphone }`.

`EncoderCapabilities` : `{ codecs, maxWidth, maxHeight, maxFps, hardwareAccelerated, audio }`.

## Événements émis

L'émetteur natif `UltracamEncoder` publie des événements regroupés sous le nom
`ultracam` ; chaque événement porte un champ `event` et un `payload` :

| `event` | `payload` |
| --- | --- |
| `config` | `{ data: base64, track?: 'video' \| 'audio' }` — SPS/PPS (AVCDecoderConfigurationRecord) ou audio config |
| `frame` | `{ data: base64, keyframe, ptsMicros, track?: 'video' \| 'audio' }` |
| `stats` | `{ fps, bitrate, dropped }` |

Les données transitent en base64 car le pont React Native ne transporte pas de
`ArrayBuffer`. `decodeBase64()` côté JS reconstruit des `Uint8Array`.

## Android (`android/`)

1. `MediaCodec` (`video/avc` ou `video/hevc`) en mode surface : la caméra
   caméra2 (`CameraCaptureSession`) écrit directement dans l'entrée de
   l'encodeur.
2. Audio : `MediaCodec` `audio/mp4a-latm` (AAC) ou `audio/opus` en repli.
3. `setOption()` mappe les réglages Pro : `lens`, `zoom`, `torch` s'appliquent à
   la session de capture ; les réglages colorimétriques (luminosité, contraste,
   saturation, gamma, netteté, teinte) sont appliqués par le shader `OpenGL ES`
   qui précède l'encodeur.
4. Un `RECORD_AUDIO`/`CAMERA` runtime permission est déjà déclarée dans
   `app.json` ; le module doit la revérifier avec `context.checkSelfPermission`.

## iOS (`ios/`)

1. `AVCaptureSession` + `AVCaptureVideoDataOutput`, encodage par `VideoToolbox`
   (`VTCompressionSession`, H.264 / HEVC).
2. Audio via `AVAudioEngine` + `AVAudioConverter` vers AAC.
3. `AVCaptureDevice` gère `lens` (`builtInWideAngleCamera` position
   avant/arrière), `zoom` (`videoZoomFactor`), `torch` et la mise au point.
4. Réglages colorimétriques appliqués dans un `CIColorControls` +
   `CIColorMatrix` avant `VTCompressionSession`.

## Intégration Expo

Déclarer le module dans `app.json` (`"plugins"`) une fois implémenté, puis
ajouter les fichiers natifs dans `android/` et `ios/`. Aucun changement n'est
nécessaire côté JS : `registerNativeEncoder()` détecte le module au démarrage.
