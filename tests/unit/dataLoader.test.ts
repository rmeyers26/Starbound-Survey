import { describe, it, expect } from 'vitest';
import { DataLoadError, loadObjects } from '../../src/game/dataLoader';
import { DataValidationError } from '../../src/game/validateObjects';

// Fake `fetch` functions let us test failures without a network.
const fakeFetch = (body: BodyInit | null, init?: ResponseInit): typeof fetch =>
  (async () => new Response(body, init)) as typeof fetch;

describe('loadObjects', () => {
  it('loads and validates good data', async () => {
    const entry = {
      id: 'a',
      name: 'A',
      type: 'star',
      imageType: 'simulation',
      region: 'inner',
      quick: 'q',
      data: {},
      source: 's',
    };
    const result = await loadObjects('/x.json', fakeFetch(JSON.stringify([entry])));
    expect(result[0].id).toBe('a');
  });
  it('reports an HTTP error', async () => {
    await expect(loadObjects('/x.json', fakeFetch('', { status: 404 }))).rejects.toThrow(
      /HTTP 404/,
    );
  });
  it('reports a network failure', async () => {
    const failing = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    await expect(loadObjects('/x.json', failing)).rejects.toBeInstanceOf(DataLoadError);
  });
  it('reports invalid JSON', async () => {
    await expect(loadObjects('/x.json', fakeFetch('not json'))).rejects.toThrow(/not valid JSON/);
  });
  it('reports invalid content', async () => {
    await expect(loadObjects('/x.json', fakeFetch('{}'))).rejects.toBeInstanceOf(
      DataValidationError,
    );
  });
});
