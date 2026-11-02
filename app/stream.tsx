import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Badge, Body, Button, Card, Divider, Row, Screen, Subtitle, Title } from '../src/components/ui';
import { streamingController, useStreaming } from '../src/hooks/useStreaming';
import { useCameraPermission } from '../src/hooks/useCameraPermission';
import { colors, radius, spacing } from '../src/theme';

export default function StreamScreen(): React.ReactElement {
  const router = useRouter();
  const streaming = useStreaming();
  const camera = useCameraPermission();
  const [busy, setBusy] = useState(false);

  const isStreaming = streaming.phase === 'streaming';
  const studio = streaming.studio;

  const toggleStream = useCallback(async () => {
    setBusy(true);
    try {
      if (isStreaming) await streamingController.stopStream();
      else await streamingController.startStream();
    } finally {
      setBusy(false);
    }
  }, [isStreaming]);

  if (!studio) {
    return (
      <Screen style={{ paddingTop: spacing.lg }}>
        <Title>Aucun Studio connecté</Title>
        <Body dim>Revenez à l’accueil pour choisir un Studio.</Body>
        <Button title="Retour" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: spacing.sm }}>
      <View style={styles.preview}>
        {camera.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing={streaming.settings.lens} />
        ) : (
          <View style={styles.previewFallback}>
            <Body dim>Caméra non autorisée.</Body>
            <Button title="Autoriser la caméra" tone="secondary" onPress={() => void camera.request()} />
          </View>
        )}
        <View style={styles.previewOverlay}>
          <Badge text={isStreaming ? 'LIVE' : 'APERÇU'} tone={isStreaming ? 'success' : 'neutral'} />
        </View>
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Subtitle>{streaming.studioName ?? studio.name}</Subtitle>
            <Body dim>
              {studio.host}:{studio.port}
            </Body>
          </View>
          <Badge text={streaming.paired ? 'Appairé' : 'Non appairé'} tone={streaming.paired ? 'success' : 'warning'} />
        </View>
        <Divider />
        <Row
          label="Format"
          value={`${streaming.settings.resolution.width}×${streaming.settings.resolution.height} @ ${streaming.settings.fps} i/s`}
        />
        <Row label="Codec" value={streaming.settings.codec.toUpperCase()} />
        <Row label="Débit cible" value={`${streaming.settings.bitrateKbps} kb/s`} />
        <Row
          label="Mesuré"
          value={`${streaming.stats.fps} i/s · ${streaming.stats.bitrateKbps} kb/s`}
        />
        <Row label="Images perdues" value={String(streaming.stats.dropped)} />
      </Card>

      {!streaming.encoderAvailable ? (
        <Card>
          <Body dim>
            L’encodeur vidéo natif n’est pas installé : seul l’aperçu est disponible. Consultez
            `modules/ultracam-encoder/README.md` pour l’activer.
          </Body>
        </Card>
      ) : null}

      {streaming.message ? (
        <Card>
          <Body dim>{streaming.message}</Body>
        </Card>
      ) : null}

      <Button
        title={isStreaming ? 'Arrêter la diffusion' : 'Démarrer la diffusion'}
        tone={isStreaming ? 'danger' : 'primary'}
        loading={busy}
        disabled={!streaming.encoderAvailable || !streaming.paired}
        onPress={() => void toggleStream()}
      />
      <Button
        title="Réglages Pro"
        tone="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => router.push('/pro')}
      />
      <Button
        title="Se déconnecter"
        tone="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          void streamingController.disconnect();
          router.replace('/');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewOverlay: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
