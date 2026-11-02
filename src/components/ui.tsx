/** Composants d'interface de base, partagés par les écrans Ultracam. */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}): React.ReactElement {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}): React.ReactElement {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({
  children,
  dim,
}: {
  children: React.ReactNode;
  dim?: boolean;
}): React.ReactElement {
  return <Text style={[styles.body, dim && { color: colors.textDim }]}>{children}</Text>;
}

export type ButtonTone = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}): React.ReactElement {
  const background =
    tone === 'primary' ? colors.accent : tone === 'danger' ? colors.danger : colors.surfaceAlt;
  const textColor = tone === 'secondary' ? colors.text : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Badge({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}): React.ReactElement {
  const map = {
    neutral: colors.textDim,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  } as const;
  const tint = map[tone];
  return (
    <View style={[styles.badge, { borderColor: tint }]}>
      <Text style={[styles.badgeText, { color: tint }]}>{text}</Text>
    </View>
  );
}

export function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function Divider(): React.ReactElement {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: spacing.sm },
  label: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  button: {
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: { color: colors.textDim, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, marginLeft: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
