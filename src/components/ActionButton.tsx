import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from 'react-native';

type Props = { title: string; onPress: () => void; selected?: boolean; disabled?: boolean; reduceMotion: boolean };

export function useReducedMotion() {
 const [reduced, setReduced] = useState(true);
 useEffect(() => {
  let mounted = true;
  void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
  const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
  return () => { mounted = false; subscription.remove(); };
 }, []);
 return reduced;
}
/** Shared feedback for every action, with no animation dependency. */
export function ActionButton({ title, onPress, selected = false, disabled = false, reduceMotion }: Props) {
 const scale = useRef(new Animated.Value(1)).current;
 useEffect(() => () => scale.stopAnimation(), [scale]);
 useEffect(() => { if (reduceMotion || disabled) { scale.stopAnimation(); scale.setValue(1); } }, [reduceMotion, disabled, scale]);
 const animate = (value: number) => {
  scale.stopAnimation();
  if (reduceMotion) { scale.setValue(1); return; }
  Animated.timing(scale, { toValue: value, duration: 100, useNativeDriver: true }).start();
 };
 return <Animated.View style={{ transform: [{ scale }] }}>
  <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
   onPress={onPress} onPressIn={() => animate(.97)} onPressOut={() => animate(1)}
   style={({ pressed }) => [styles.button, selected && styles.selected, pressed && styles.pressed, disabled && styles.disabled]}>
   <Text style={styles.text}>{title}</Text>
  </Pressable>
 </Animated.View>;
}
const styles = StyleSheet.create({
 button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 17, paddingVertical: 13, borderRadius: 10, backgroundColor: '#252c3c' },
 selected: { backgroundColor: '#7460e8' }, pressed: { opacity: .8 }, disabled: { opacity: .4 },
 text: { color: 'white', fontWeight: '600', fontSize: 12 },
});
