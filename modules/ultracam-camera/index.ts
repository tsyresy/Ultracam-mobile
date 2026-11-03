import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';
export type CameraProps = ViewProps & { url: string; facing: string; torch: boolean; zoom: number; fps: number; quality: number; onStatus: (event: { nativeEvent: { state: string; message: string; frames?: number } }) => void };
export default requireNativeViewManager<CameraProps>('UltracamCamera');
