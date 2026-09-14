import { describe, it, expect } from 'vitest';
import { generateBotKey, hashBotKey } from '../../../../Services/Ai/keys/index.js';

describe('AI keys', () => {
  it('genera una clave de 64 caracteres hex', () => {
    const key = generateBotKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('genera claves únicas', () => {
    const key1 = generateBotKey();
    const key2 = generateBotKey();
    expect(key1).not.toBe(key2);
  });

  it('hashea la clave con sha256', async () => {
    const key = 'abc123';
    const hash = await hashBotKey(key);
    expect(hash).toBe('6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090');
  });
});
