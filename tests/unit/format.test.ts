import { describe, it, expect } from 'vitest';
import { formatMeasurement, formatNumber, regionName, typeLabel } from '../../src/ui/format';
import { sheetAction } from '../../src/ui/sheetGesture';

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(12742)).toBe('12,742');
    expect(formatNumber(1392684)).toBe('1,392,684');
  });
  it('keeps useful decimals but not noise', () => {
    expect(formatNumber(365.256)).toBe('365.256');
    expect(formatNumber(9.807)).toBe('9.807');
    expect(formatNumber(149597870.7)).toBe('149,597,870.7');
  });
  it('uses scientific notation for huge and tiny values', () => {
    expect(formatNumber(1.9885e30)).toBe('1.9885 × 10³⁰');
    expect(formatNumber(5.9722e24)).toBe('5.9722 × 10²⁴');
    expect(formatNumber(0.0000123)).toContain('× 10⁻'); // negative exponent
  });
  it('handles zero and negatives', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-26.74)).toBe('-26.74');
  });
});

describe('formatMeasurement', () => {
  it('appends the unit', () => {
    expect(formatMeasurement({ label: 'Diameter', value: 12742, unit: 'km' })).toBe('12,742 km');
  });
  it('shows text values and unit-less numbers as-is', () => {
    expect(formatMeasurement({ label: 'Type', value: 'G2V' })).toBe('G2V');
    expect(formatMeasurement({ label: 'Mag', value: -26.74 })).toBe('-26.74');
  });
});

describe('labels', () => {
  it('maps region ids and falls back to the id', () => {
    expect(regionName('inner')).toBe('Inner Solar System');
    expect(regionName('mystery')).toBe('mystery');
  });
  it('turns camelCase types into words', () => {
    expect(typeLabel('blackHole')).toBe('Black hole');
    expect(typeLabel('planet')).toBe('Planet');
  });
});

describe('sheetAction', () => {
  it('swipe up expands, swipe down collapses, tap toggles', () => {
    expect(sheetAction(-60)).toBe('expand');
    expect(sheetAction(60)).toBe('collapse');
    expect(sheetAction(2)).toBe('toggle');
    expect(sheetAction(0)).toBe('toggle');
  });
  it('an in-between wobble does nothing', () => {
    expect(sheetAction(20)).toBeNull();
    expect(sheetAction(-20)).toBeNull();
  });
});
