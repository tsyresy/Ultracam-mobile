import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, Card, Label, Screen, Title } from '../src/components/ui';
import { streamingController, useStreaming } from '../src/hooks/useStreaming';
import { colors, spacing } from '../src/theme';

const CODE_LENGTH = 6;

export default function PairScreen(): React.ReactElement {
  const router = useRouter();
  const streaming = useStreaming();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (streaming.phase === 'ready') router.replace('/stream');
  }, [streaming.phase, router]);

  const submit = useCallback(async () => {
    if (code.length !== CODE_LENGTH) return;
    setBusy(true);
    await streamingController.submitPairingCode(code);
    setBusy(false);
  }, [code]);

  return (
    <Screen style={{ paddingTop: spacing.lg }}>
      <Title>Saisir le code</Title>
      <Body dim>
        Ultracam Studio affiche un code à 6 chiffres. Il est valable 5 minutes et change à chaque
        tentative manquée.
      </Body>

      <Card style={{ marginTop: spacing.md }}>
        <Label>Code d’appairage</Label>
        <TextInput
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
          placeholder="000000"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          onSubmitEditing={() => void submit()}
        />
        <Button
          title="Valider"
          style={{ marginTop: spacing.md }}
          loading={busy}
          disabled={code.length !== CODE_LENGTH}
          onPress={() => void submit()}
        />
      </Card>

      {streaming.message ? <Body dim>{streaming.message}</Body> : null}

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Button
          title="Le Studio n’est pas celui attendu"
          tone="secondary"
          onPress={() => {
            void streamingController.disconnect();
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    textAlign: 'center',
    fontSize: 30,
    letterSpacing: 10,
    paddingVertical: 14,
  },
});
