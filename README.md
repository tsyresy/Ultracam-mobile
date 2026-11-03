# Ultracam Remote Mobile — version 0.1.0

Nouvelle application Expo/React Native avec module caméra natif Kotlin (Android CameraX) et Swift (iOS AVFoundation). Aucun dépôt Git n’est nécessaire pour la compilation. Vos images et les identifiants Firebase `app.ultracam.mobile` sont conservés.

## Utilisation Android

Installer `release/Ultracam-Remote-Mobile.apk`, ouvrir l’application et autoriser la caméra. Sur le même réseau privé que le PC, scanner le QR affiché par Ultracam Studio Pro. Le flux doit ensuite apparaître sur le Studio.

L’aperçu, le changement avant/arrière, la torche et le zoom dépendent des capacités du téléphone. La cadence sélectionnée (10/15/24/30 fps) est une cible maximale ; l’application saute des images si le réseau est saturé. Capture native visant 720p, JPEG configurable, orientation native de la caméra. Le Studio propose une rotation si nécessaire.

Le lien d’appairage est sensible et le transport local n’est pas chiffré. Aucune transmission à Firebase n’est implémentée ; ses fichiers de configuration sont conservés pour la suite.

## Construire Android

Pré-requis : Node.js 20, JDK 17 ou 21, SDK Android 35, NDK 26.1.10909125 et accès aux registres de dépendances.

```sh
npm ci
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease --no-daemon
```

Expo SDK 52 / React Native 0.76.5 sont utilisés pour correspondre à la chaîne Android disponible sur cette machine. Le fichier `package-lock.json` verrouille les dépendances. Une migration vers un SDK plus récent sera nécessaire avant une publication sur les stores et devra être testée séparément.

La clé de signature propre à Ultracam se trouve dans `signing/ultracam-release.p12`, ses paramètres dans `signing/release.properties`. Ces fichiers privés sont nécessaires aux futures mises à jour : en faire une sauvegarde sûre, ne pas les distribuer avec l’APK. La version release n’utilise pas la clé Android debug. Ne pas remplacer la clé après distribution.

## iOS

Le module Swift est fourni, mais **n’a pas été compilé ni testé** sur Ubuntu. Il faut macOS, Xcode, CocoaPods et une signature Apple pour produire et installer une version iOS. Exécuter `npx expo prebuild --platform ios` puis compiler depuis Xcode. Expo Go ne charge pas ce module natif ; utiliser une compilation dédiée.

## État de cette version

Cette livraison transmet la vidéo uniquement. Audio, transport USB direct, contrôles manuels complets de la caméra, effets IA, H.264/HEVC et modes 4K ne sont pas implémentés. Les trois plateformes doivent encore faire l’objet d’essais réels de caméra et de reconnexion. Le téléphone n’a pas été testé matériellement dans cet environnement.

Vérification TypeScript : `npm run typecheck`. Les sources de l’application sont `App.tsx` et `modules/ultracam-camera/`. Le dossier `analysis/decompiled` contient l’analyse de référence ; il n’est ni importé ni inclus dans l’application.
