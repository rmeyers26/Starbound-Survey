// Game-progress rules, kept separate from storage so they stay simple pure functions.
import type { SaveRecord } from '../save/schema';

/** Returns a copy of the save with one more inspection of `objectId` counted. */
export function recordInspection(record: SaveRecord, objectId: string): SaveRecord {
  const previous = record.inspectedObjects[objectId] ?? 0;
  return { ...record, inspectedObjects: { ...record.inspectedObjects, [objectId]: previous + 1 } };
}

/** How many different objects (out of `knownIds`) have been inspected at least once. */
export function countInspected(record: SaveRecord, knownIds: string[]): number {
  return knownIds.filter((id) => (record.inspectedObjects[id] ?? 0) > 0).length;
}
