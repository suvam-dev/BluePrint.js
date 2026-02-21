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

  // ── Try Truss Solver (Direct Stiffness Method) ───────────────────────────
  if (system.members.length > 0) {
    const N = system.nodes.length;
    const K = Array.from({ length: 2 * N }, () => Array(2 * N).fill(0));
    const nodeIdx = {};
    system.nodes.forEach((n, i) => nodeIdx[n.id] = i);

    system.members.forEach((m) => {
      const i = nodeIdx[m.startNodeId];
      const j = nodeIdx[m.endNodeId];
      const nA = nodeMap[m.startNodeId];
      const nB = nodeMap[m.endNodeId];
      if (nA && nB && i !== undefined && j !== undefined) {
        const dx = px(nB) - px(nA);
        const dy = py(nB) - py(nA);
        const L = Math.hypot(dx, dy);
        if (L > 0) {
          const c = dx / L, s = dy / L;
          const k1 = c * c / L, k2 = c * s / L, k3 = s * s / L;
          
          K[2*i][2*i]   += k1; K[2*i][2*i+1] += k2; K[2*i][2*j]   -= k1; K[2*i][2*j+1] -= k2;
          K[2*i+1][2*i] += k2; K[2*i+1][2*i+1]+= k3;K[2*i+1][2*j] -= k2; K[2*i+1][2*j+1]-= k3;
          
          K[2*j][2*i]   -= k1; K[2*j][2*i+1] -= k2; K[2*j][2*j]   += k1; K[2*j][2*j+1] += k2;
          K[2*j+1][2*i] -= k2; K[2*j+1][2*i+1]-= k3;K[2*j+1][2*j] += k2; K[2*j+1][2*j+1]+= k3;
        }
      }
    });

    const K_orig = K.map(row => [...row]);
    const F_app = Array(2 * N).fill(0);
    
    // Add artificial soft springs to ground to prevent singular matrix for unsupported trusses
    for (let c = 0; c < 2 * N; c++) {
      K[c][c] += 1e-6;
    }

    forces.forEach(f => {
      const idx = nodeIdx[f.nodeId];
      if (idx !== undefined) {
        const rad = (f.angle * Math.PI) / 180;
        F_app[2*idx]   += f.magnitude * Math.cos(rad);
        F_app[2*idx+1] += f.magnitude * Math.sin(rad);
      }
    });

    const fixedDOFs = new Set();
    supports.forEach(sp => {
      const idx = nodeIdx[sp.nodeId];
      if (idx !== undefined) {
        if (sp.type === 'pin' || sp.type === 'fixed') {
          fixedDOFs.add(2*idx);
          fixedDOFs.add(2*idx+1);
        } else if (sp.type === 'roller') {
          fixedDOFs.add(2*idx+1);
        }
      }
    });

    const F = [...F_app];
    fixedDOFs.forEach(dof => {
      for (let c = 0; c < 2 * N; c++) K[dof][c] = 0;
      for (let r = 0; r < 2 * N; r++) {
        if (!fixedDOFs.has(r)) F[r] -= K[r][dof] * 0;
        K[r][dof] = 0;
      }
      K[dof][dof] = 1;
      F[dof] = 0;
    });

    try {
      const xVec = lusolve(K, F);
      const U = xVec.map(v => v[0]);

      const nodalForces = Array(2 * N).fill(0);
      for (let r = 0; r < 2 * N; r++) {
        for (let c = 0; c < 2 * N; c++) {
          nodalForces[r] += K_orig[r][c] * U[c];
        }
      }

      const reactions = {};
      supports.forEach(sp => {
        const idx = nodeIdx[sp.nodeId];
        if (idx !== undefined) {
          if (!reactions[sp.nodeId]) reactions[sp.nodeId] = {};
          const rx = nodalForces[2*idx] - F_app[2*idx];
          const ry = nodalForces[2*idx+1] - F_app[2*idx+1];
          if (sp.type === 'pin') {
            reactions[sp.nodeId]['Rx'] = parseFloat(rx.toFixed(3));
            reactions[sp.nodeId]['Ry'] = parseFloat(ry.toFixed(3));
          } else if (sp.type === 'roller') {
            reactions[sp.nodeId]['Ry'] = parseFloat(ry.toFixed(3));
          } else if (sp.type === 'fixed') {
            reactions[sp.nodeId]['Rx'] = parseFloat(rx.toFixed(3));
            reactions[sp.nodeId]['Ry'] = parseFloat(ry.toFixed(3));
          }
        }
      });

      const memberForces = {};
      system.members.forEach(m => {
        const i = nodeIdx[m.startNodeId];
        const j = nodeIdx[m.endNodeId];
        const nA = nodeMap[m.startNodeId];
        const nB = nodeMap[m.endNodeId];
        if (nA && nB) {
          const dx = px(nB) - px(nA);
          const dy = py(nB) - py(nA);
          const L = Math.hypot(dx, dy);
          if (L > 0) {
            const c = dx / L, s = dy / L;
            const force = (1 / L) * ((U[2*j] - U[2*i]) * c + (U[2*j+1] - U[2*i+1]) * s);
            memberForces[m.id] = {
              value: parseFloat(force.toFixed(3)),
              type: Math.abs(force) < 0.001 ? '0' : (force > 0 ? 'T' : 'C')
            };
          }
        }
      });

      let maxDisplacement = 0;
      U.forEach(u => maxDisplacement = Math.max(maxDisplacement, Math.abs(u)));
      const isUnstable = fixedDOFs.size < 3 || maxDisplacement > 1e3;
      
      const detStr = isUnstable ? 'Unstable Truss (Mechanisms / Free Body)' 
        : (fixedDOFs.size + system.members.length > 2 * N 
        ? 'Statically indeterminate truss (DSM) ✓' 
        : 'Statically determinate truss ✓');

      // We still return reactions and memberForces even if unstable!
      return { determinacy: detStr, reactions, memberForces };
    } catch (e) {
      // Singular matrix
    }
  }

  // ── Fallback to 3x3 global body eq ──────────────────────────────────────
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
