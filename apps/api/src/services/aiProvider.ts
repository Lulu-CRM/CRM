import { simulatedProvider, type AiProvider } from '@lulu/shared';

// AI runs behind one interface (AGENTS.md rule 7). The simulated provider answers until a model is
// connected; a real provider registers here under its AI_PROVIDER name and needs AI_API_KEY.
const providers: Record<string, AiProvider> = {
  simulated: simulatedProvider,
};

export function getAiProvider(name: string): AiProvider {
  const provider = providers[name];
  if (provider === undefined) {
    throw new Error(
      `AI_PROVIDER "${name}" is not available. Known: ${Object.keys(providers).join(', ')}`,
    );
  }
  return provider;
}
