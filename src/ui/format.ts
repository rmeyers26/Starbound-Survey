// Turns raw data into text people can read. Pure functions, so they are easy to unit test.
import type { ImageType, Measurement } from '../game/types';

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

/** 1.9885e30 -> "1.9885 × 10³⁰" (superscript digits read well on small screens). */
function scientific(value: number): string {
  const [mantissa, exponent] = value.toExponential(4).split('e');
  const cleanMantissa = String(Number(mantissa)); // drops trailing zeros: "1.9885", "5.9722"
  const power = String(Number(exponent)); // "+30" -> "30", "-3" stays "-3"
  const sup = [...power].map((ch) => SUPERSCRIPT[ch] ?? ch).join('');
  return `${cleanMantissa} × 10${sup}`;
}

export function formatNumber(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e9 || abs < 1e-3) return scientific(value);
  // en-US is fixed on purpose so the same data always looks the same.
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** "12,742 km", "G2V", "-26.74". */
export function formatMeasurement(m: Measurement): string {
  const text = typeof m.value === 'number' ? formatNumber(m.value) : m.value;
  return m.unit ? `${text} ${m.unit}` : text;
}

export const IMAGE_TYPE_LABEL: Record<ImageType, string> = {
  observation: 'Observation',
  artistConcept: "Artist's Concept",
  simulation: 'Simulation',
};

export const IMAGE_TYPE_DESCRIPTION: Record<ImageType, string> = {
  observation: 'A real telescope image.',
  artistConcept: 'An artist’s illustration, because no photograph exists.',
  simulation: 'A computer-generated view, not a photograph.',
};

const REGION_NAME: Record<string, string> = {
  inner: 'Inner Solar System',
  outer: 'Outer Solar System',
  kuiper: 'Kuiper Belt',
  stars: 'Local Stars',
  nebulae: 'Nebulae',
  clusters: 'Clusters',
  galaxies: 'Galaxies',
  extreme: 'Extreme Objects',
};

export const regionName = (id: string): string => REGION_NAME[id] ?? id;

/** "blackHole" -> "Black hole" */
export function typeLabel(type: string): string {
  const spaced = type.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
