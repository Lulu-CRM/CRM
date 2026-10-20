import { simulatedProvider } from '@lulu/shared';
import { describe, expect, it } from 'vitest';
import { getAiProvider } from './aiProvider';

describe('getAiProvider', () => {
  it('gives the simulated provider until a model is connected', () => {
    expect(getAiProvider('simulated')).toBe(simulatedProvider);
  });

  it('fails loudly for a provider that is not available yet', () => {
    expect(() => getAiProvider('some-model')).toThrow(/AI_PROVIDER "some-model" is not available/);
  });
});
