import React, { useState } from 'react';
import { solve } from '../utils/solver';
import useMechanicsStore from '../store/mechanicsStore';
import EquationPanel from './EquationPanel';
import {
  Cpu, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Code2, Trash2, Plus
} from 'lucide-react';

const GRID = 40;

function AddRodForm() {
  const addRodDirectly = useMechanicsStore(s => s.addRodDirectly);
  const [vals, setVals] = useState({ x: '0', y: '0', len: '5', ang: '0' });
  
  const handleAdd = () => {
    addRodDirectly(parseFloat(vals.x||0), parseFloat(vals.y||0), parseFloat(vals.len||0), parseFloat(vals.ang||0));
  };
  
  return (
    <div className="mb-2" style={{ background: 'rgba(52,211,153,0.03)', border: '1px solid rgba(52,211,153,0.1)', borderRadius: '0.5rem' }}>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
          <span className="text-xs font-bold mono text-emerald-400">ADD DIRECT ROD</span>
        </div>
      </div>
      <div className="px-2 pb-2 flex flex-col gap-2">
        <div className="flex gap-2">
          <input className="w-1/2 bg-[#070d1a] border border-blue-900 rounded p-1.5 text-xs text-blue-100 mono text-center focus:outline-none focus:border-emerald-500 transition-colors" value={vals.x} onChange={e => setVals({...vals, x: e.target.value})} placeholder="Start X" />
          <input className="w-1/2 bg-[#070d1a] border border-blue-900 rounded p-1.5 text-xs text-blue-100 mono text-center focus:outline-none focus:border-emerald-500 transition-colors" value={vals.y} onChange={e => setVals({...vals, y: e.target.value})} placeholder="Start Y" />
        </div>
        <div className="flex gap-2">
          <input className="w-1/2 bg-[#070d1a] border border-blue-900 rounded p-1.5 text-xs text-blue-100 mono text-center focus:outline-none focus:border-emerald-500 transition-colors" value={vals.len} onChange={e => setVals({...vals, len: e.target.value})} placeholder="Length" />
          <input className="w-1/2 bg-[#070d1a] border border-blue-900 rounded p-1.5 text-xs text-blue-100 mono text-center focus:outline-none focus:border-emerald-500 transition-colors" value={vals.ang} onChange={e => setVals({...vals, ang: e.target.value})} placeholder="Angle (°)" />
        </div>
        <button onClick={handleAdd} 
          className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/50 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
          <Plus size={12} strokeWidth={3} /> ADD ROD
        </button>
      </div>
    </div>
  );
}

function Section({ title, count, color, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-xs font-medium mono" style={{ color }}>{title}</span>
          <span className="text-[10px] mono px-1.5 rounded-full"
            style={{ background: `${color}22`, color }}>{count}</span>
        </div>
        {open ? <ChevronDown size={12} style={{ color }} /> : <ChevronRight size={12} style={{ color }} />}
      </button>
      {open && <div className="mt-1 px-1 animate-fadeIn">{children}</div>}
    </div>
  );
}

function ItemRow({ label, value, color = '#60a5fa', sub, onDelete }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg mb-1 group"
      style={{ background: 'rgba(13,27,46,0.6)', border: '1px solid rgba(59,130,246,0.08)' }}>
      <div className="flex-1 min-w-0">
        <span className="text-xs mono" style={{ color }}>{label}</span>
        {sub && <div className="text-[10px] mono mt-0.5" style={{ color: '#3c6080' }}>{sub}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {value !== undefined && (
          <span className="text-xs mono font-semibold" style={{ color }}>{value}</span>
        )}
        {onDelete && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded"
            style={{ color: '#f87171' }}>
            <Trash2 size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const {
    system, solution, setSolution, setSolveError, solveError,
    removeNode, clearSolution
  } = useMechanicsStore();
  const { nodes, members, supports, forces, moments } = system;
  const [showJson, setShowJson] = useState(false);

  const handleSolve = () => {
    const result = solve(system);
    if (result.reactions && Object.keys(result.reactions).length > 0) {
      setSolution(result);
    } else {
      setSolveError(result.determinacy);
    }
  };

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Derive unknowns from supports
  const unknowns = supports.flatMap((sp) => {
    const node = nodeMap[sp.nodeId];
    if (!node) return [];
    const label = node.label;
    if (sp.type === 'pin')    return [`R_${label}x`, `R_${label}y`];
    if (sp.type === 'roller') return [`R_${label}y`];
    if (sp.type === 'fixed')  return [`R_${label}x`, `R_${label}y`, `M_${label}`];
    return [];
  });

  const determinacyStatus = unknowns.length === 3 ? 'determinate'
    : unknowns.length < 3 ? 'mechanism' : 'indeterminate';

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: 'rgba(7,13,26,0.97)',
        borderLeft: '1px solid rgba(59,130,246,0.15)',
        width: '250px',
        minWidth: '250px',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold mono" style={{ color: '#60a5fa' }}>System Object</div>
            <div className="text-[10px] mono mt-0.5" style={{ color: '#3c6080' }}>
              {nodes.length}N · {members.length}M · {supports.length}S · {forces.length + moments.length}L
            </div>
          </div>
          <button
            onClick={() => setShowJson(s => !s)}
            title="Toggle JSON view"
            className="p-1.5 rounded-lg transition-colors"
            style={{
              background: showJson ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
              color: showJson ? '#60a5fa' : '#3c6080',
              border: `1px solid ${showJson ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
            }}
          >
            <Code2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* JSON Panel */}
        {showJson && (
          <div className="px-2 py-3 animate-fadeIn" style={{ borderBottom: '1px solid rgba(59,130,246,0.08)' }}>
            <div className="text-[9px] mono mb-2" style={{ color: '#3c6080', letterSpacing: '0.08em' }}>RAW JSON</div>
            <pre className="text-[9px] mono rounded-lg p-2 overflow-auto max-h-48"
              style={{ background: '#030810', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.15)' }}>
              {JSON.stringify(system, null, 2)}
            </pre>
          </div>
        )}

        <div className="px-2 py-3">

          <AddRodForm />

          {/* KNOWNS */}
          <Section title="KNOWNS" count={forces.length + moments.length} color="#facc15">
            {forces.length === 0 && moments.length === 0 && (
              <div className="text-[10px] mono px-2 py-2" style={{ color: '#3c6080' }}>No loads applied yet</div>
            )}
            {forces.map((f) => {
              const n = nodeMap[f.nodeId];
              const fx = +(f.magnitude * Math.cos((f.angle * Math.PI) / 180)).toFixed(2);
              const fy = +(f.magnitude * Math.sin((f.angle * Math.PI) / 180)).toFixed(2);
              return (
                <ItemRow key={f.id}
                  label={`F at ${n?.label ?? f.nodeId}`}
                  value={`${f.magnitude}kN`}
                  color="#facc15"
                  sub={`∠${f.angle}° → Fx=${fx}  Fy=${fy}`}
                />
              );
            })}
            {moments.map((mo) => {
              const n = nodeMap[mo.nodeId];
              return (
                <ItemRow key={mo.id}
                  label={`M at ${n?.label ?? mo.nodeId}`}
                  value={`${mo.magnitude}kN·m`}
                  color="#c084fc"
                />
              );
            })}
          </Section>

          {/* UNKNOWNS */}
          <Section title="UNKNOWNS" count={unknowns.length} color="#60a5fa">
            {unknowns.length === 0 && (
              <div className="text-[10px] mono px-2 py-2" style={{ color: '#3c6080' }}>Add supports to generate unknowns</div>
            )}
            {unknowns.map((u) => (
              <ItemRow key={u} label={u} color="#60a5fa" />
            ))}
            {unknowns.length > 0 && (
              <div className="px-2 py-1.5 mt-1 rounded-lg text-[10px] mono"
                style={{
                  background: determinacyStatus === 'determinate'
                    ? 'rgba(52,211,153,0.08)' : determinacyStatus === 'mechanism'
                    ? 'rgba(251,146,60,0.08)' : 'rgba(248,113,113,0.08)',
                  color: determinacyStatus === 'determinate' ? '#34d399'
                    : determinacyStatus === 'mechanism' ? '#fb923c' : '#f87171',
                }}>
                {determinacyStatus === 'determinate' && `✓ Statically determinate  (n=${unknowns.length})`}
                {determinacyStatus === 'mechanism'    && `⚠ Mechanism  (${unknowns.length} < 3)`}
                {determinacyStatus === 'indeterminate'&& `✗ Indeterminate  (${unknowns.length} > 3)`}
              </div>
            )}
          </Section>

          {/* NODES */}
          <Section title="NODES" count={nodes.length} color="#7fa8d4" defaultOpen={false}>
            {nodes.map((n) => (
              <ItemRow key={n.id}
                label={n.label}
                value={`(${(n.x/GRID).toFixed(2)}, ${-(n.y/GRID).toFixed(2)})`}
                color="#7fa8d4"
                onDelete={() => { clearSolution(); removeNode(n.id); }}
              />
            ))}
            {nodes.length === 0 && (
              <div className="text-[10px] mono px-2 py-2" style={{ color: '#3c6080' }}>No nodes placed</div>
            )}
          </Section>

          {/* EQUATIONS */}
          {unknowns.length > 0 && <EquationPanel />}

          {/* MEMBER FORCES */}
          {solution?.memberForces && (
            <Section title="MEMBER FORCES" count={Object.keys(solution.memberForces).length} color="#c084fc">
              {Object.entries(solution.memberForces).map(([mId, force]) => {
                const m = members.find(m => m.id === mId);
                const nA = nodeMap[m?.startNodeId];
                const nB = nodeMap[m?.endNodeId];
                const label = nA && nB ? `${nA.label}—${nB.label}` : mId;
                return (
                  <ItemRow key={mId}
                    label={label}
                    value={`${Math.abs(force.value).toFixed(2)}kN (${force.type})`}
                    color={force.type === 'T' ? '#34d399' : force.type === 'C' ? '#f87171' : '#3c6080'}
                  />
                );
              })}
            </Section>
          )}

          {/* REACTIONS */}
          {(solution || solveError) && (
            <Section title="REACTIONS" count={solution ? Object.values(solution.reactions ?? {}).reduce((s, r) => s + Object.keys(r).length, 0) : 0} color="#34d399">
              {solveError && (
                <div className="flex items-start gap-2 px-2 py-2 rounded-lg mb-1"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
                  <span className="text-[10px] mono" style={{ color: '#f87171' }}>{solveError}</span>
                </div>
              )}
              {solution?.determinacy && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg"
                  style={{ background: 'rgba(52,211,153,0.08)' }}>
                  <CheckCircle2 size={11} style={{ color: '#34d399' }} />
                  <span className="text-[10px] mono" style={{ color: '#34d399' }}>{solution.determinacy}</span>
                </div>
              )}
              {solution?.reactions && Object.entries(solution.reactions).map(([nodeId, reacts]) => {
                const n = nodeMap[nodeId];
                return Object.entries(reacts).map(([comp, val]) => (
                  <ItemRow key={`${nodeId}-${comp}`}
                    label={`${comp} at ${n?.label ?? nodeId}`}
                    value={`${val > 0 ? '+' : ''}${val} ${comp === 'M' ? 'kN·m' : 'kN'}`}
                    color={Math.abs(val) < 0.001 ? '#3c6080' : '#34d399'}
                  />
                ));
              })}
            </Section>
          )}
        </div>
      </div>

      {/* Solve Button */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(59,130,246,0.12)' }}>
        <button
          onClick={handleSolve}
          className="w-full py-2.5 rounded-xl text-sm font-semibold mono transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
            boxShadow: '0 0 20px rgba(59,130,246,0.3)',
            color: 'white',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 30px rgba(59,130,246,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.3)'; e.currentTarget.style.transform = 'none'; }}
        >
          <Cpu size={15} />
          SOLVE SYSTEM
        </button>
        <div className="text-[9px] mono text-center mt-1.5" style={{ color: '#3c6080' }}>
          [A]·x = b  ·  mathjs lusolve
        </div>
      </div>
    </div>
  );
}
