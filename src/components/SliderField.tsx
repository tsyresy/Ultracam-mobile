/**
 * Curseur de réglage Pro.
 *
 * Utilise `@react-native-community/slider` lorsqu'il est installé ; sinon
 * dégrade en touches −/+ pour que l'écran reste entièrement utilisable.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Label } from './ui';
import { colors, radius, spacing } from '../theme';

type NativeSlider = React.ComponentType<{
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: object;
}>;

let Slider: NativeSlider | null = null;
try {
  Slider = require('@react-native-community/slider').default as NativeSlider;
} catch {
  Slider = null;
}

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: SliderFieldProps): React.ReactElement {
  const display = format ? format(value) : String(Math.round(value * 100) / 100);
  const nudge = (direction: 1 | -1) => {
    const next = clamp(Math.round((value + direction * step) * 1e6) / 1e6, min, max);
    onChange(next);
  };

  return (
    <View style={[styles.container, disabled && { opacity: 0.45 }]}>
      <View style={styles.header}>
        <Label>{label}</Label>
        <Text style={styles.value}>{display}</Text>
      </View>
      {Slider ? (
        <Slider
          value={value}
          minimumValue={min}
          maximumValue={max}
          step={step}
          disabled={disabled}
          onValueChange={onChange}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.accent}
          style={styles.slider}
        />
      ) : (
        <View style={styles.fallback}>
          <Pressable
            onPress={() => nudge(-1)}
            disabled={disabled}
            style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { width: `${max === min ? 0 : ((value - min) / (max - min)) * 100}%` },
              ]}
            />
          </View>
          <Pressable
            onPress={() => nudge(1)}
            disabled={disabled}
            style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      )}
      {!Slider && min !== max ? <Body dim>Curseur tactile non installé : ajustez avec − / +.</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { color: colors.text, fontSize: 14, fontWeight: '700' },
  slider: { width: '100%', height: 34 },
  fallback: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: colors.accent },
});
