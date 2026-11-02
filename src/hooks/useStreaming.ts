/**
 * Pont entre le `StreamingController` (pur TypeScript) et React.
 *
 * Le contrôleur est un singleton de module : tous les écrans partagent donc le
 * même état de connexion et de diffusion, sans contexte React.
 */

import { useEffect, useState } from 'react';
import { loadOrCreateIdentity } from '../services/identity';
import { StreamingController, StreamingState } from '../services/streaming';

export const streamingController = new StreamingController({
  loadCredentials: loadOrCreateIdentity,
});

export function useStreaming(): StreamingState {
  const [state, setState] = useState<StreamingState>(() => streamingController.current);
  useEffect(() => streamingController.subscribe(setState), []);
  return state;
}
