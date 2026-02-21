import React, { useMemo } from 'react';
import useMechanicsStore from '../store/mechanicsStore';

const GRID = 40;

// Convert a float to a pretty signed string: +5.00 or -3.25
const fmt = (v, digits = 2) => {
  const n = Number(v);
  const abs = Math.abs(n).toFixed(digits);
  return n >= 0 ? `+${abs}` : `-${abs}`;
};

// Angle → component display
const fmtComp = (magnitude, angle, comp) => {
  const rad = (angle * Math.PI) / 180;
  const val = comp === 'x'
    ? magnitude * Math.cos(rad)
    : magnitude * Math.sin(rad);
  return fmt(val);
};

/**
 * Builds a human-readable string for each equilibrium equation
 * with all terms substituted in.
 */
function buildEquations(system) {
  const { nodes, supports, forces, moments } = system;
  if (!nodes.length) return null;

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const px = (node) => node.x / GRID;
  const py = (node) => -(node.y / GRID); // Y-up

  // Known force resultants
  let sumFx = 0, sumFy = 0, sumMz = 0;
  const fxTerms = [], fyTerms = [], mzTerms = [];

  for (const f of forces) {
    const node = nodeMap[f.nodeId];
    if (!node) continue;
    const rad = (f.angle * Math.PI) / 180;
    const fx = f.magnitude * Math.cos(rad);
    const fy = f.magnitude * Math.sin(rad);
    const x = px(node), y = py(node);
    sumFx += fx; sumFy += fy;
    sumMz += x * fy - y * fx;

    fxTerms.push({ label: `F_${node.label}x`, val: fx });
    fyTerms.push({ label: `F_${node.label}y`, val: fy });
    if (x * fy - y * fx !== 0)
      mzTerms.push({ label: `M(F_${node.label})`, val: x * fy - y * fx });
  }

  for (const mo of moments) {
    const node = nodeMap[mo.nodeId];
    sumMz += mo.magnitude;
    mzTerms.push({ label: `M_${node?.label}`, val: mo.magnitude });
  }

  // Unknown reaction terms from supports
  const rxTerms = [], ryTerms = [], rmzTerms = [];
  for (const sp of supports) {
    const node = nodeMap[sp.nodeId];
    if (!node) continue;
    const x = px(node), y = py(node);

    if (sp.type === 'pin' || sp.type === 'fixed') {
      rxTerms.push(`R_${node.label}x`);
      ryTerms.push(`R_${node.label}y`);
      rmzTerms.push({ label: `R_${node.label}x`, arm: -y, dir: 'x' });
      rmzTerms.push({ label: `R_${node.label}y`, arm: x, dir: 'y' });
    }
    if (sp.type === 'roller') {
      ryTerms.push(`R_${node.label}y`);
      rmzTerms.push({ label: `R_${node.label}y`, arm: x, dir: 'y' });
    }
    if (sp.type === 'fixed') {
      rmzTerms.push({ label: `M_${node.label}`, arm: 1, dir: 'M' });
    }
  }

  return {
    eqFx: {
      lhs: rxTerms.length ? rxTerms.join(' + ') : '0',
      rhs: fxTerms.length ? fxTerms.map(t => `(${t.val.toFixed(2)})`).join(' + ') : '0',
      sumKnown: sumFx,
    },
    eqFy: {
      lhs: ryTerms.length ? ryTerms.join(' + ') : '0',
      rhs: fyTerms.length ? fyTerms.map(t => `(${t.val.toFixed(2)})`).join(' + ') : '0',
      sumKnown: sumFy,
    },
    eqMz: {
      lhs: rmzTerms.length
        ? rmzTerms.map(t => t.dir === 'M' ? t.label : `${t.label}·(${t.arm.toFixed(2)})`).join(' + ')
        : '0',
      rhs: mzTerms.length ? mzTerms.map(t => `(${t.val.toFixed(2)})`).join(' + ') : '0',
      sumKnown: sumMz,
    },
  };
}

function buildMojEquations(system) {
  const { nodes, members, supports, forces } = system;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const px = (node) => node.x / GRID;
  const py = (node) => -(node.y / GRID);

  const nodeEqs = [];
  
  for (const n of nodes) {
    const fxLhs = [];
    const fyLhs = [];
    let sumKnownFx = 0;
    let sumKnownFy = 0;

    // Supports at this node
    const sp = supports.find(s => s.nodeId === n.id);
    if (sp) {
      if (sp.type === 'pin' || sp.type === 'fixed') {
        fxLhs.push(`R_${n.label}x`);
        fyLhs.push(`R_${n.label}y`);
      }
      if (sp.type === 'roller') {
        fyLhs.push(`R_${n.label}y`);
      }
    }

    // Members connected to this node
    for (const m of members) {
      if (m.startNodeId === n.id || m.endNodeId === n.id) {
        const otherId = m.startNodeId === n.id ? m.endNodeId : m.startNodeId;
        const other = nodeMap[otherId];
        if (other) {
          const dx = px(other) - px(n);
          const dy = py(other) - py(n);
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            const cosT = dx / len;
            const sinT = dy / len;
            const labelN1 = nodeMap[m.startNodeId].label;
            const labelN2 = nodeMap[m.endNodeId].label;
            const FLab = `F_{${labelN1}${labelN2}}`;

            if (Math.abs(cosT) > 0.001) {
              const sign = cosT > 0 ? '+' : '-';
              const val = Math.abs(cosT) > 0.99 ? FLab : `${Math.abs(cosT).toFixed(2)}${FLab}`;
              fxLhs.push(`${sign} ${val}`);
            }
            if (Math.abs(sinT) > 0.001) {
              const sign = sinT > 0 ? '+' : '-';
              const val = Math.abs(sinT) > 0.99 ? FLab : `${Math.abs(sinT).toFixed(2)}${FLab}`;
              fyLhs.push(`${sign} ${val}`);
            }
          }
        }
      }
    }

    // Forces at this node
    for (const f of forces) {
      if (f.nodeId === n.id) {
        const rad = (f.angle * Math.PI) / 180;
        sumKnownFx += f.magnitude * Math.cos(rad);
        sumKnownFy += f.magnitude * Math.sin(rad);
      }
    }

    // Format right-hand side
    const formatTerms = (terms) => {
      let str = terms.join(' ');
      if (str.startsWith('+ ')) str = str.substring(2); // remove leading +
      return str || '0';
    };

    nodeEqs.push({
      label: n.label,
      fxLhs: formatTerms(fxLhs),
      fxRhs: `-(${fmt(sumKnownFx)})`,
      fyLhs: formatTerms(fyLhs),
      fyRhs: `-(${fmt(sumKnownFy)})`
    });
  }
  return nodeEqs;
}

function EqRow({ label, eq, color }) {
  if (!eq) return null;
  return (
    <div className="mb-3 rounded-lg p-3 animate-fadeIn"
      style={{ background: 'rgba(13,27,46,0.7)', border: `1px solid ${color}22` }}>
      <div className="text-[10px] mono mb-1.5 font-semibold" style={{ color }}>
        {label}
      </div>
      {/* LHS = 0 */}
      <div className="text-[10px] mono mb-1" style={{ color: '#e2eeff' }}>
        <span style={{ color }}>{eq.lhs}</span>
        <span style={{ color: '#3c6080' }}> + </span>
        <span style={{ color: '#facc15' }}>{eq.rhs}</span>
        <span style={{ color: '#3c6080' }}> = 0</span>
      </div>
      {/* Simplified */}
      <div className="text-[10px] mono" style={{ color: '#3c6080' }}>
        → <span style={{ color }}>{eq.lhs}</span>
        <span style={{ color: '#3c6080' }}> = {fmt(-eq.sumKnown)}</span>
      </div>
    </div>
  );
}

export default function EquationPanel() {
  const { system, solution } = useMechanicsStore();
  const eqs = useMemo(() => buildEquations(system), [system]);

  if (!eqs) return null;

  return (
    <div className="px-2 pb-2">
      <div className="text-[9px] mono px-2 py-1 mb-2 rounded"
        style={{ color: 'rgba(167,139,250,0.8)', background: 'rgba(167,139,250,0.06)',
          borderLeft: '2px solid rgba(167,139,250,0.4)', letterSpacing: '0.08em' }}>
        EQUILIBRIUM EQUATIONS
      </div>
      <EqRow label="ΣFx = 0" eq={eqs.eqFx} color="#60a5fa" />
      <EqRow label="ΣFy = 0" eq={eqs.eqFy} color="#60a5fa" />
      <EqRow label="ΣMz = 0 (about origin)" eq={eqs.eqMz} color="#a78bfa" />

      {/* METHOD OF JOINTS */}
      {system.members.length > 0 && (
        <div className="mt-2 mb-2">
          <div className="text-[9px] mono px-2 py-1 mb-2 rounded border-l-2"
            style={{ color: '#fb923c', background: 'rgba(251,146,60,0.06)', borderColor: 'rgba(251,146,60,0.4)', letterSpacing: '0.08em' }}>
            METHOD OF JOINTS (NODE EQ)
          </div>
          {buildMojEquations(system).map((nodeData, idx) => (
            <div key={idx} className="mb-2 p-2 rounded-lg" style={{ background: 'rgba(13,27,46,0.5)', border: '1px solid rgba(251,146,60,0.15)' }}>
              <div className="text-[10px] mono mb-1 font-semibold" style={{ color: '#fb923c' }}>NODE {nodeData.label}</div>
              <div className="text-[9px] mono" style={{ color: '#e2eeff' }}>
                <span style={{ color: '#fb923c' }}>ΣFx: </span>{nodeData.fxLhs} = <span style={{ color: '#facc15' }}>{nodeData.fxRhs}</span>
              </div>
              <div className="text-[9px] mono mt-1" style={{ color: '#e2eeff' }}>
                <span style={{ color: '#fb923c' }}>ΣFy: </span>{nodeData.fyLhs} = <span style={{ color: '#facc15' }}>{nodeData.fyRhs}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {solution?.reactions && (
        <div className="mt-1 rounded-lg p-2"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <div className="text-[9px] mono mb-1" style={{ color: '#34d399', letterSpacing: '0.08em' }}>
            SOLUTION VECTOR
          </div>
          {Object.entries(solution.reactions).map(([nodeId, reacts]) => {
            const node = system.nodes.find(n => n.id === nodeId);
            return Object.entries(reacts).map(([comp, val]) => (
              <div key={`${nodeId}-${comp}`} className="text-[10px] mono flex justify-between">
                <span style={{ color: '#7fa8d4' }}>
                  {comp === 'M' ? `M` : `R`}_{node?.label ?? nodeId}{comp !== 'M' ? comp.slice(1) : ''}
                </span>
                <span className="font-semibold" style={{ color: '#34d399' }}>
                  {val > 0 ? '+' : ''}{val} {comp === 'M' ? 'kN·m' : 'kN'}
                </span>
              </div>
            ));
          })}
        </div>
      )}
    </div>
  );
}
