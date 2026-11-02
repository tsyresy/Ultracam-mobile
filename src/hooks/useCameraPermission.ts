/** Demande et expose l'autorisation caméra/micro de `expo-camera`. */

import { useCallback, useEffect, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';

export interface CameraPermissionState {
  granted: boolean;
  canAskAgain: boolean;
  loading: boolean;
  request: () => Promise<boolean>;
}

export function useCameraPermission(): CameraPermissionState {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const request = useCallback(async () => {
    setLoading(true);
    try {
      const result = await requestPermission();
      return result.granted;
    } finally {
      setLoading(false);
    }
  }, [requestPermission]);

  return {
    granted: permission?.granted ?? false,
    canAskAgain: permission?.canAskAgain ?? true,
    loading,
    request,
  };
}
