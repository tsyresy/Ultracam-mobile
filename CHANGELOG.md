# Historique des mises à jour

## 0.1.2 — 2026-11-04 — Correctif caméra Android local

- Correction de l’aperçu noir : les demandes de mesure et de placement de la surface CameraX sont désormais prises en charge par la vue Expo (`shouldUseAndroidLayout`).
- Aperçu en mode compatible TextureView avec dimensions explicites pour son conteneur.
- Défaut reproduit sur Xiaomi M2007J17C : ouverture caméra suivie d’un timeout de surface après cinq secondes, même sans scanner le QR.
- APK local code 9 installé sans suppression des données ; retour de l’aperçu confirmé sur le téléphone.
- Transmission USB réelle confirmée après scan : plus de 250 images reçues sans déconnexion.
- Correction supplémentaire de la résolution : sélection explicite 16:9 ciblant 1920x1080, exclusion des tailles supérieures et repli vers une résolution inférieure. Le choix précédent produisait du 3000x3000 sur ce téléphone et environ 2,15 fps à JPEG 90 %.
- Compilation release, TypeScript et tests d’appairage réussis. Second APK installé ; résolution et cadence après cette seconde correction en attente de mesure. Le démarrage automatique au branchement reste à implémenter ; 30 fps réels ne sont pas encore validés.

## 0.1.1 — 2026-11-03 — Sources préparées, non publiées

### Connexion et cohérence
- Mode USB Android explicite : adaptation du lien d’appairage à `127.0.0.1:49721` en conservant le token. Nécessite le tunnel ADB créé par le Studio 0.1.1, un câble de données et l’autorisation de débogage USB du téléphone.
- Indicateur vidéo basé sur l’état de transmission ; une erreur ou une fermeture remet le compteur à zéro et permet une nouvelle tentative avec le lien conservé.
- Les changements caméra reçus du Studio sont répercutés dans les contrôles mobiles.
- Torche désactivée dans l’interface pour la caméra avant ; accès aux réglages système après refus permanent de permission.

### Interface et ressources
- Composant `ActionButton` partagé : cibles de 48 points minimum, états accessibles, retour visuel de pression et animation native de 100 ms.
- Réduction des mouvements respectée, avec un seul abonnement système pour l’écran ; aucune bibliothèque ajoutée.
- Buffers de pixels, bitmap et sortie JPEG réutilisés par le thread d’encodage Android ; libération à la fermeture de la vue.
- Décodeurs GIF/WebP désactivés dans la configuration générée : les ressources utilisées sont PNG et le flux JPEG reste natif.
- Pas de réduction chiffrée promise sur l’APK : l’ancien APK inclut quatre architectures natives, qui représentent l’essentiel de son poids. Le profil EAS production produit un AAB.

### Validation
- TypeScript et tests d’appairage Wi-Fi/USB.
- Export Metro/Hermes Android.
- Compilation Kotlin release du module caméra.
- Compilation Windows du Studio et 16 tests automatisés, dont cinq cas ADB avec exécuteur simulé.
- Validation matérielle encore requise : Android + Windows, tunnel ADB réel, Wi-Fi interrompu, reconnexion, commandes, caméra avant/arrière, mémoire et température sur 30 minutes, accessibilité et animations.
- iOS : contrat d’événements adapté, mais compilation et tests iOS non réalisés sur cette machine Linux.

Le build EAS 0.1.0 déjà envoyé ne contient pas ces changements. Cette mise à jour nécessite une nouvelle compilation native Android et une nouvelle distribution Windows ; elle n’est pas livrable uniquement par mise à jour JavaScript OTA.
