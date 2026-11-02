import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerNativeEncoder } from '../src/services/encoderBridge';
import { colors } from '../src/theme';

export default function RootLayout(): React.ReactElement {
  useEffect(() => {
    registerNativeEncoder();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Ultracam Mobile' }} />
        <Stack.Screen name="connect" options={{ title: 'Connexion' }} />
        <Stack.Screen name="pair" options={{ title: 'Appairage' }} />
        <Stack.Screen name="stream" options={{ title: 'Diffusion' }} />
        <Stack.Screen name="pro" options={{ title: 'Réglages Pro' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
