import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, Label, Screen, Title } from '../src/components/ui';
import { streamingController, useStreaming } from '../src/hooks/useStreaming';
import { DEFAULT_PORT } from '../src/protocol/constants';
import { spacing } from '../src/theme';

/** Écran de connexion : lance la poignée de main puis route selon le résultat. */
export default function ConnectScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ host?: string; port?: string; name?: string }>();
  const streaming = useStreaming();
  const started = useRef(false);

  const host = typeof params.host === 'string' ? params.host : '';
  const port = params.port ? Number(params.port) : DEFAULT_PORT;
  const name = typeof params.name === 'string' ? params.name : host;

  const connect = useCallback(
    () =>
      streamingController.connect({
        key: `${host}:${port}`,
        name: name || host,
        host,
        port,
        protocol: 1,
        plain: false,
      }),
    [host, port, name]
  );

  useEffect(() => {
    if (started.current || !host) return;
    started.current = true;
    void connect();
  }, [connect, host]);

  useEffect(() => {
    if (streaming.phase === 'ready') router.replace('/stream');
    if (streaming.phase === 'pairing') router.replace('/pair');
  }, [streaming.phase, router]);

  const retry = useCallback(() => {
    started.current = false;
    router.replace({ pathname: '/connect', params: { host, port: String(port), name } });
  }, [host, name, port, router]);

  return (
    <Screen style={{ paddingTop: spacing.lg }}>
      <Title>{name || host}</Title>
      <Card>
        <Label>Adresse</Label>
        <Body>
          {host}:{port}
        </Body>
        <Label>État</Label>
        <Body>{streaming.message ?? describe(streaming.phase)}</Body>
      </Card>

      {streaming.phase === 'error' ? (
        <View style={{ gap: spacing.sm }}>
          <Button title="Réessayer" onPress={retry} />
          <Button
            title="Se connecter"
            tone="secondary"
            onPress={() => {
              void streamingController.forgetPairing();
              retry();
            }}
          />
          <Button title="Retour" tone="secondary" onPress={() => router.back()} />
        </View>
      ) : null}

      {streaming.phase === 'connecting' ? (
        <Body dim>Recherche du Studio et négociation du protocole…</Body>
      ) : null}
    </Screen>
  );
}

function describe(phase: string): string {
  switch (phase) {
    case 'connecting':
      return 'Connexion en cours…';
    case 'pairing':
      return 'Le Studio attend un code d’appairage.';
    case 'ready':
      return 'Appairé.';
    case 'streaming':
      return 'Diffusion en cours.';
    case 'error':
      return 'Échec de la connexion.';
    default:
      return 'Inactif.';
  }
}
