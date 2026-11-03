// A cutaway picture of an object's layers: concentric coloured bands, like slicing the Sun in half.
// Drawn as inline SVG (a picture made of shapes), so it stays sharp at any size and needs no image file.
// Layers that a scan has not revealed yet are drawn as dim, unlabelled bands, so the picture hints that there
// is more to discover without giving the names away.
import type { Layer } from '../game/types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HIDDEN_FILL = '#1a2342';
const HIDDEN_STROKE = '#33477e';

/** Builds the SVG. `revealed` holds the ids of the layers a scan has uncovered. */
export function createLayersDiagram(
  objectName: string,
  layers: Layer[],
  revealed: ReadonlySet<string>,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-104 -104 208 208'); // a little margin around a radius-100 picture
  svg.setAttribute('class', 'layers-diagram');
  svg.setAttribute('role', 'img');
  const known = layers.filter((l) => revealed.has(l.id)).length;
  svg.setAttribute(
    'aria-label',
    `Cutaway picture of the layers of ${objectName}: ${known} of ${layers.length} layers revealed. The names and descriptions are in the list below.`,
  );

  // Paint the OUTERMOST band first and the innermost last, so each smaller circle sits on top of the bigger one.
  const outerFirst = [...layers].sort((a, b) => b.ring[1] - a.ring[1]);
  for (const layer of outerFirst) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', String(layer.ring[1] * 100));
    const isRevealed = revealed.has(layer.id);
    circle.setAttribute('fill', isRevealed ? layer.color : HIDDEN_FILL);
    circle.setAttribute('stroke', isRevealed ? '#0b1020' : HIDDEN_STROKE);
    circle.setAttribute('stroke-width', '0.6');
    const title = document.createElementNS(SVG_NS, 'title'); // the tooltip on hover
    title.textContent = isRevealed ? layer.name : 'A layer not yet revealed';
    circle.append(title);
    svg.append(circle);
  }
  return svg;
}
