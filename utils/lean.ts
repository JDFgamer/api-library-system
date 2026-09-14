/**
 * Mongoose .lean() skips toJSON transforms, so `_id` is not mapped to `id`.
 * These helpers normalize lean documents to match the API contract (id: string).
 */

type LeanDoc = { _id?: unknown; __v?: unknown };

export function withId<T extends LeanDoc>(
  doc: T | null | undefined
): (T & { id: string }) | null | undefined {
  if (!doc) return doc as null | undefined;
  const result: Record<string, unknown> = { ...doc, id: String(doc._id) };
  delete result._id;
  delete result.__v;
  return result as T & { id: string };
}

export function withIds<T extends LeanDoc>(
  docs: T[]
): Array<T & { id: string }> {
  return docs.map(doc => withId(doc) as T & { id: string });
}
