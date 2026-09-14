import { createHash, randomBytes } from 'crypto';

const BOT_KEY_BYTES = 32;
const ENCODING = 'hex' as const;

export const generateBotKey = (): string => randomBytes(BOT_KEY_BYTES).toString(ENCODING);

export const hashBotKey = async (key: string): Promise<string> => {
  const hash = createHash('sha256');
  hash.update(key);
  return hash.digest(ENCODING);
};
