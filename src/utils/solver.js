import { lusolve } from 'mathjs';

const GRID = 40; // pixels per grid unit — must match CanvasBoard.jsx

/**
 * solve(system) → { reactions: { [nodeId]: {Rx?, Ry?, M?} }, determinacy: string }
 *
 * Node coordinates are stored in SCREEN PIXELS (multiples of GRID px).
 * Divide by GRID to convert to dimensionless grid units for moment arms.
 *
 * Canvas Y-axis points DOWNWARD, but statics convention has Y pointing UP.
 * So: math_y = -screen_y  (flip sign for moment arms and applied force Fy)
 *
 * Supports → unknowns:
 *   pin    → Rx, Ry        (2 unknowns)
 *   roller → Ry            (1 unknown)
 *   fixed  → Rx, Ry, M    (3 unknowns)
 *
 * Equilibrium (3 equations):
 *   ΣFx = 0
 *   ΣFy = 0
 *   ΣMz = 0  (about origin, CCW positive)
 */
export function solve(system) {
  const { nodes, supports, forces, moments } = system;

  // Build a map for quick node lookup
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Helper: convert screen coords to statics coords (grid units, Y-up)
  const px = (node) => node.x / GRID;
  const py = (node) => -(node.y / GRID);   // flip Y: canvas down → statics up

  // ── Enumerate unknowns from supports ─────────────────────────────────────
  const unknowns = [];
  for (const sp of supports) {
    const node = nodeMap[sp.nodeId];
    if (!node) continue;
    const x = px(node);
    const y = py(node);
    if (sp.type === 'pin') {
      unknowns.push({ nodeId: sp.nodeId, comp: 'Rx', x, y });
      unknowns.push({ nodeId: sp.nodeId, comp: 'Ry', x, y });
    } else if (sp.type === 'roller') {
      unknowns.push({ nodeId: sp.nodeId, comp: 'Ry', x, y });
    } else if (sp.type === 'fixed') {
      unknowns.push({ nodeId: sp.nodeId, comp: 'Rx', x, y });
      unknowns.push({ nodeId: sp.nodeId, comp: 'Ry', x, y });
      unknowns.push({ nodeId: sp.nodeId, comp: 'M',  x, y });
    }
  }

  const nUnknowns = unknowns.length;

  if (nUnknowns === 0) return { determinacy: 'No supports — free body', reactions: {} };
  if (nUnknowns < 3)   return { determinacy: `Mechanism (only ${nUnknowns} reaction${nUnknowns > 1 ? 's' : ''})`, reactions: {} };
  if (nUnknowns > 3)   return { determinacy: `Statically indeterminate (${nUnknowns} unknowns > 3 equations)`, reactions: {} };

  // ── Build A matrix (3×3) ─────────────────────────────────────────────────
  // Row 0: ΣFx = 0
  // Row 1: ΣFy = 0
  // Row 2: ΣMz = 0  r × F = x·Ry − y·Rx   (CCW +)
  const A = [[0,0,0],[0,0,0],[0,0,0]];
  const b = [0, 0, 0];

  unknowns.forEach((u, i) => {
    if (u.comp === 'Rx') {
      A[0][i] = 1;
      A[2][i] = -u.y;   // moment of Rx about O = Rx·(-y_statics) ... wait: M = r×F
                         // Actually moment of horizontal force Rx at (x,y): z-comp = x·0 − y·Rx = -y·Rx
    } else if (u.comp === 'Ry') {
      A[1][i] = 1;
      A[2][i] = u.x;    // moment of vertical force Ry at (x,y): z-comp = x·Ry − y·0 = x·Ry
    } else if (u.comp === 'M') {
      A[2][i] = 1;       // pure couple
    }
  });

  // ── Compute known load resultants (RHS) ──────────────────────────────────
  let sumFx = 0, sumFy = 0, sumMz = 0;

  for (const f of forces) {
    const node = nodeMap[f.nodeId];
    if (!node) continue;
    const rad = (f.angle * Math.PI) / 180;
    const fx = f.magnitude * Math.cos(rad);
    // Angle is CCW from +X in statics convention; canvas angle is already stored that way
    // but canvas Fy is screen-downward, so statics Fy = -screen_fy:
    // Actually force angle is entered by user in statics convention (CCW from +X),
    // so fy from angle -90° = sin(-90°) = -1, meaning 1 unit downward in statics → correct
    const fy = f.magnitude * Math.sin(rad);
    sumFx += fx;
    sumFy += fy;
    // Moment about origin (statics coords):
    const x = px(node);
    const y = py(node);
    sumMz += x * fy - y * fx;
  }

  for (const mo of moments) {
    sumMz += mo.magnitude;  // user enters CCW+, consistent with statics
  }

  // A·reactions = −(known loads)
  b[0] = -sumFx;
  b[1] = -sumFy;
  b[2] = -sumMz;

  // ── Solve ─────────────────────────────────────────────────────────────────
  let xVec;
  try {
    xVec = lusolve(A, b);
  } catch {
    return { determinacy: 'Singular system — check geometry', reactions: {} };
  }

  // ── Map results to nodeIds ────────────────────────────────────────────────
  const reactions = {};
  unknowns.forEach((u, i) => {
    if (!reactions[u.nodeId]) reactions[u.nodeId] = {};
    const val = Number(xVec[i][0]);
    reactions[u.nodeId][u.comp] = parseFloat(val.toFixed(3));
  });

  return { determinacy: 'Statically determinate ✓', reactions };
}
