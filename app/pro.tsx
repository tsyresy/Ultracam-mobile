import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SliderField } from '../src/components/SliderField';
import { Badge, Body, Button, Card, Divider, Label, Screen, Subtitle, Title } from '../src/components/ui';
import { streamingController, useStreaming } from '../src/hooks/useStreaming';
import { DEFAULT_PRO_SETTINGS, ProSettings } from '../src/protocol/constants';
import { colors, radius, spacing } from '../src/theme';

const RESOLUTIONS: Array<{ label: string; width: number; height: number }> = [
  { label: '480p', width: 854, height: 480 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
];

const FPS_OPTIONS = [24, 25, 30, 50, 60];
const CODECS: Array<ProSettings['codec']> = ['h264', 'hevc'];
const AUDIO_CODECS: Array<ProSettings['audioCodec']> = ['aac', 'opus'];

export default function ProScreen(): React.ReactElement {
  const router = useRouter();
  const streaming = useStreaming();
  const settings = streaming.settings;
  const disabled = !streaming.paired;

  const update = useCallback((patch: Partial<ProSettings>) => {
    void streamingController.updateSettings(patch);
  }, []);

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Title>Réglages Pro</Title>
          <Badge text={streaming.paired ? 'Synchronisé' : 'Hors ligne'} tone={streaming.paired ? 'success' : 'warning'} />
        </View>
        <Body dim>
          Chaque modification est transmise immédiatement à Ultracam Studio : les deux applications
          partagent les mêmes réglages.
        </Body>

        <Card style={{ marginTop: spacing.md }}>
          <Subtitle>Optique</Subtitle>
          <Segmented
            label="Objectif"
            value={settings.lens}
            options={[
              { value: 'back', label: 'Arrière' },
              { value: 'front', label: 'Avant' },
            ]}
            disabled={disabled}
            onChange={(lens) => update({ lens })}
          />
          <Toggle
            label="Torche"
            value={settings.torch}
            disabled={disabled || settings.lens === 'front'}
            onChange={(torch) => update({ torch })}
          />
          <SliderField
            label="Zoom"
            value={settings.zoom}
            min={1}
            max={10}
            step={0.1}
            format={(v) => `${v.toFixed(1)}×`}
            disabled={disabled}
            onChange={(zoom) => update({ zoom })}
          />
          <SliderField
            label="Mise au point"
            value={settings.focus}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)} %`}
            disabled={disabled}
            onChange={(focus) => update({ focus })}
          />
          <SliderField
            label="Balance des blancs"
            value={settings.whiteBalance}
            min={-1}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(whiteBalance) => update({ whiteBalance })}
          />
          <SliderField
            label="Correction d’exposition"
            value={settings.exposureCompensation}
            min={-2}
            max={2}
            step={0.05}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} IL`}
            disabled={disabled}
            onChange={(exposureCompensation) => update({ exposureCompensation })}
          />
        </Card>

        <Card>
          <Subtitle>Image</Subtitle>
          <SliderField
            label="Luminosité"
            value={settings.brightness}
            min={-1}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(brightness) => update({ brightness })}
          />
          <SliderField
            label="Contraste"
            value={settings.contrast}
            min={-1}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(contrast) => update({ contrast })}
          />
          <SliderField
            label="Saturation"
            value={settings.saturation}
            min={-1}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(saturation) => update({ saturation })}
          />
          <SliderField
            label="Gamma"
            value={settings.gamma}
            min={0.4}
            max={2.5}
            step={0.05}
            format={(v) => v.toFixed(2)}
            disabled={disabled}
            onChange={(gamma) => update({ gamma })}
          />
          <SliderField
            label="Netteté"
            value={settings.sharpness}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(sharpness) => update({ sharpness })}
          />
          <SliderField
            label="Teinte"
            value={settings.hue}
            min={-180}
            max={180}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            disabled={disabled}
            onChange={(hue) => update({ hue })}
          />
          <SliderField
            label="Lissage de peau"
            value={settings.beauty}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)} %`}
            disabled={disabled}
            onChange={(beauty) => update({ beauty })}
          />
          <Divider />
          <Toggle
            label="HDR"
            value={settings.hdr}
            disabled={disabled}
            onChange={(hdr) => update({ hdr })}
          />
          <Toggle
            label="Stabilisation"
            value={settings.stabilization}
            disabled={disabled}
            onChange={(stabilization) => update({ stabilization })}
          />
          <Toggle
            label="Effet miroir"
            value={settings.mirror}
            disabled={disabled}
            onChange={(mirror) => update({ mirror })}
          />
          <Toggle
            label="Image propre (clean frame)"
            value={settings.cleanFrame}
            disabled={disabled}
            onChange={(cleanFrame) => update({ cleanFrame })}
          />
        </Card>

        <Card>
          <Subtitle>Encodage vidéo</Subtitle>
          <Segmented
            label="Résolution"
            value={`${settings.resolution.width}x${settings.resolution.height}`}
            options={RESOLUTIONS.map((r) => ({ value: `${r.width}x${r.height}`, label: r.label }))}
            disabled={disabled}
            onChange={(value) => {
              const found = RESOLUTIONS.find((r) => `${r.width}x${r.height}` === value);
              if (found) update({ resolution: { width: found.width, height: found.height } });
            }}
          />
          <Segmented
            label="Images par seconde"
            value={String(settings.fps)}
            options={FPS_OPTIONS.map((fps) => ({ value: String(fps), label: `${fps}` }))}
            disabled={disabled}
            onChange={(value) => update({ fps: Number(value) })}
          />
          <SliderField
            label="Débit cible"
            value={settings.bitrateKbps}
            min={1000}
            max={40000}
            step={500}
            format={(v) => `${v} kb/s`}
            disabled={disabled}
            onChange={(bitrateKbps) => update({ bitrateKbps })}
          />
          <Segmented
            label="Codec"
            value={settings.codec}
            options={CODECS.map((codec) => ({ value: codec, label: codec.toUpperCase() }))}
            disabled={disabled}
            onChange={(codec) => update({ codec })}
          />
        </Card>

        <Card>
          <Subtitle>Audio</Subtitle>
          <Toggle
            label="Microphone"
            value={settings.audioEnabled}
            disabled={disabled}
            onChange={(audioEnabled) => update({ audioEnabled })}
          />
          <Segmented
            label="Codec audio"
            value={settings.audioCodec}
            options={AUDIO_CODECS.map((codec) => ({ value: codec, label: codec.toUpperCase() }))}
            disabled={disabled || !settings.audioEnabled}
            onChange={(audioCodec) => update({ audioCodec })}
          />
          <SliderField
            label="Débit audio"
            value={settings.audioBitrateKbps}
            min={64}
            max={320}
            step={8}
            format={(v) => `${v} kb/s`}
            disabled={disabled || !settings.audioEnabled}
            onChange={(audioBitrateKbps) => update({ audioBitrateKbps })}
          />
        </Card>

        <Card>
          <Subtitle>Presets</Subtitle>
          <Segmented
            label="Style d’image"
            value={settings.preset}
            options={[
              { value: 'none', label: 'Neutre' },
              { value: 'warm', label: 'Chaleureux' },
              { value: 'cool', label: 'Froid' },
              { value: 'vivid', label: 'Éclatant' },
              { value: 'cinema', label: 'Cinéma' },
            ]}
            disabled={disabled}
            onChange={(preset) => update({ preset })}
          />
        </Card>

        <Button
          title="Réinitialiser les réglages Pro"
          tone="secondary"
          disabled={disabled}
          onPress={() => update({ ...DEFAULT_PRO_SETTINGS })}
        />
        <Button
          title="Retour à la diffusion"
          tone="secondary"
          style={{ marginTop: spacing.sm }}
          onPress={() => router.push('/stream')}
        />
      </ScrollView>
    </Screen>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}): React.ReactElement {
  return (
    <View style={[styles.segmented, disabled && { opacity: 0.45 }]}>
      <Label>{label}</Label>
      <View style={styles.segmentedRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.toggleRow, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segmented: { marginBottom: spacing.md },
  segmentedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#ffffff' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 14 },
  switch: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text },
  knobOn: { alignSelf: 'flex-end' },
});
