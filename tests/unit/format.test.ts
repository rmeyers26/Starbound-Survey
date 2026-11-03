import { describe, it, expect } from 'vitest';
import {
  formatMeasurement,
  formatNumber,
  regionName,
  speedNote,
  typeLabel,
} from '../../src/ui/format';
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

describe('speedNote (honest display speed)', () => {
  it('says nothing when an orbit is drawn at its true speed', () => {
    expect(speedNote(365.256, 365.256)).toBeNull();
    expect(speedNote(365.256, 366)).toBeNull(); // within 2 percent counts as true
  });

  it('says when an orbit is drawn faster than real', () => {
    expect(speedNote(60182, 1320)).toBe(
      'Its orbit is drawn about 46 times faster than real, so you can watch it move.',
    );
    expect(speedNote(1000, 500)).toContain('2 times faster');
  });

  it('says when an orbit is drawn slower than real', () => {
    expect(speedNote(0.31891, 12)).toBe(
      'Its orbit is drawn about 38 times slower than real, so you can follow it.',
    );
  });

  it('copes with nonsense without throwing or printing NaN', () => {
    expect(speedNote(0, 10)).toBeNull();
    expect(speedNote(10, 0)).toBeNull();
    expect(speedNote(NaN, 10)).toBeNull();
  });
});
