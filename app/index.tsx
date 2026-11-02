import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Body, Button, Card, Label, Screen, Subtitle, Title } from '../src/components/ui';
import { streamingController, useStreaming } from '../src/hooks/useStreaming';
import { DiscoveredStudio, StudioDiscovery } from '../src/services/discovery';
import { loadManualStudios, saveManualStudio } from '../src/services/preferences';
import { colors, spacing } from '../src/theme';

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const streaming = useStreaming();
  const [studios, setStudios] = useState<DiscoveredStudio[]>([]);
  const [manual, setManual] = useState<DiscoveredStudio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const exploration = useRef<StudioDiscovery | null>(null);

  useEffect(() => {
    const discovery = new StudioDiscovery({
      onChange: setStudios,
      onError: (message) => setError(message),
    });
    exploration.current = discovery;
    discovery.start();

    void loadManualStudios().then((entries) => {
      for (const entry of entries) discovery.addManual(entry.host, entry.port, entry.name);
      setManual(discovery.list.filter((item) => entries.some((e) => e.host === item.host)));
    });

    return () => {
      discovery.stop();
      exploration.current = null;
    };
  }, []);

  const known = useMemo(() => {
    const map = new Map<string, DiscoveredStudio>();
    for (const studio of [...manual, ...studios]) map.set(studio.key, studio);
    return Array.from(map.values());
  }, [manual, studios]);

  const openStudio = useCallback(
    (studio: DiscoveredStudio) => {
      router.push({
        pathname: '/connect',
        params: { host: studio.host, port: String(studio.port), name: studio.name },
      });
    },
    [router]
  );

  const addManualStudio = useCallback(async () => {
    const trimmed = host.trim();
    if (!trimmed) return;
    const [rawHost, rawPort] = trimmed.split(':');
    const port = Number(rawPort) || undefined;
    const studio = exploration.current?.addManual(rawHost, port);
    if (!studio) return;
    await saveManualStudio({ host: studio.host, port: studio.port, name: studio.name });
    setManual((current) => [...current.filter((item) => item.key !== studio.key), studio]);
    setHost('');
  }, [host]);

  return (
    <Screen style={{ paddingTop: insets.top + spacing.md }}>
      <View style={styles.scroll}>
        <View style={styles.header}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            accessibilityLabel="Logo Ultracam Mobile"
          />
          <View style={{ flex: 1 }}>
            <Title>Ultracam Mobile</Title>
            <Body dim>Diffusez votre caméra vers un Studio Ultracam de votre réseau.</Body>
          </View>
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.statusRow}>
            <Label>État</Label>
            <Badge
              text={phaseLabel(streaming.phase)}
              tone={
                streaming.phase === 'streaming'
                  ? 'success'
                  : streaming.phase === 'error'
                    ? 'danger'
                    : 'neutral'
              }
            />
          </View>
          <Body dim>
            {streaming.studioName
              ? `Studio : ${streaming.studioName}`
              : 'Aucun Studio connecté pour le moment.'}
          </Body>
          {streaming.phase === 'streaming' || streaming.phase === 'ready' ? (
            <Button
              title="Ouvrir la diffusion"
              style={{ marginTop: spacing.sm }}
              onPress={() => router.push('/stream')}
            />
          ) : null}
        </Card>

        <Subtitle>Studios détectés</Subtitle>
        {known.length === 0 ? (
          <Card>
            <Body dim>Aucun Studio sur le réseau. Lancez Ultracam Studio, ou saisissez une adresse.</Body>
          </Card>
        ) : (
          <FlatList
            data={known}
            keyExtractor={(item) => item.key}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Card>
                <View style={styles.studioRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studioName}>{item.name}</Text>
                    <Body dim>
                      {item.host}:{item.port} · protocole v{item.protocol}
                      {item.plain ? ' · HTTP clair' : ''}
                    </Body>
                  </View>
                  <Button title="Connecter" onPress={() => openStudio(item)} />
                </View>
              </Card>
            )}
          />
        )}

        <Subtitle>Ajouter manuellement</Subtitle>
        <Card>
          <Label>Adresse</Label>
          <TextInput
            value={host}
            onChangeText={setHost}
            placeholder="192.168.1.20:47900"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            onSubmitEditing={() => void addManualStudio()}
          />
          <Button
            title="Ajouter"
            tone="secondary"
            style={{ marginTop: spacing.sm }}
            onPress={() => void addManualStudio()}
          />
          {error ? <Body dim>Erreur de découverte : {error}</Body> : null}
        </Card>

        <Button
          title="Se déconnecter du Studio"
          tone="danger"
          disabled={!streaming.studio}
          onPress={() => void streamingController.disconnect()}
        />
      </View>
    </Screen>
  );
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'connecting':
      return 'Connexion…';
    case 'pairing':
      return 'Appairage requis';
    case 'ready':
      return 'Appairé';
    case 'streaming':
      return 'En diffusion';
    case 'error':
      return 'Erreur';
    default:
      return 'Inactif';
  }
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 56, height: 56, borderRadius: 14 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  studioName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 15,
  },
});
