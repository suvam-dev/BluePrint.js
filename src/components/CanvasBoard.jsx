import React, { useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow, Arc, Group, Rect, RegularPolygon } from 'react-konva';
import useMechanicsStore from '../store/mechanicsStore';

const GRID = 40; // pixels per grid unit
const NODE_R = 8;
const SNAP_THRESHOLD = 20; // snap to existing node within this many px

// ─── Coordinate helpers ─────────────────────────────────────────────────
// Canvas uses screen coords; our system uses grid units
// We keep everything in screen pixels for the canvas,
// but display in "grid units" (divide by GRID) in the sidebar/equations

function snapToGrid(val) {
  return Math.round(val / GRID) * GRID;
}

function nearestNode(nodes, x, y) {
  let best = null, bestDist = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return bestDist < SNAP_THRESHOLD ? best : null;
}

// ─── Support Shapes ─────────────────────────────────────────────────────
function PinSupport({ x, y, size = 22 }) {
  return (
    <Group x={x} y={y}>
      {/* Triangle */}
      <RegularPolygon sides={3} radius={size * 0.7} x={0} y={size * 0.55}
        fill="#1e3a5f" stroke="#60a5fa" strokeWidth={2} rotation={180} />
      {/* Ground line */}
      <Line points={[-size, size * 1.1, size, size * 1.1]} stroke="#60a5fa" strokeWidth={2} />
      <Line points={[-size * 0.85, size * 1.25, -size * 0.55, size * 1.1]} stroke="#60a5fa" strokeWidth={1.5} />
      <Line points={[-size * 0.35, size * 1.25, -size * 0.05, size * 1.1]} stroke="#60a5fa" strokeWidth={1.5} />
      <Line points={[size * 0.15, size * 1.25, size * 0.45, size * 1.1]} stroke="#60a5fa" strokeWidth={1.5} />
      <Line points={[size * 0.65, size * 1.25, size * 0.95, size * 1.1]} stroke="#60a5fa" strokeWidth={1.5} />
    </Group>
  );
}

function RollerSupport({ x, y, size = 22 }) {
  return (
    <Group x={x} y={y}>
      {/* Triangle */}
      <RegularPolygon sides={3} radius={size * 0.7} x={0} y={size * 0.4}
        fill="#1e3a5f" stroke="#34d399" strokeWidth={2} rotation={180} />
      {/* Roller circles */}
      <Circle x={-size * 0.4} y={size * 1.05} radius={size * 0.22} fill="none" stroke="#34d399" strokeWidth={2} />
      <Circle x={size * 0.4} y={size * 1.05} radius={size * 0.22} fill="none" stroke="#34d399" strokeWidth={2} />
      {/* Ground line */}
      <Line points={[-size, size * 1.3, size, size * 1.3]} stroke="#34d399" strokeWidth={2} />
    </Group>
  );
}

function FixedSupport({ x, y, size = 22 }) {
  return (
    <Group x={x} y={y}>
      {/* Wall */}
      <Rect x={-6} y={-size} width={12} height={size * 2} fill="#1e3a5f" stroke="#fb923c" strokeWidth={2} />
      {/* Hatch lines */}
      {[-size * 0.7, -size * 0.3, size * 0.1, size * 0.5, size * 0.9].map((yy, i) => (
        <Line key={i} points={[-14, yy, -6, yy - 8]} stroke="#fb923c" strokeWidth={1.5} />
      ))}
    </Group>
  );
}

// ─── Force Arrow ────────────────────────────────────────────────────────
function ForceArrow({ x, y, magnitude, angle }) {
  const rad = ((angle) * Math.PI) / 180;
  const len = Math.min(80, Math.max(40, Math.abs(magnitude) * 4));
  const dx = Math.cos(rad) * len;
  const dy = -Math.sin(rad) * len; // flip Y (canvas Y is down)
  return (
    <Group>
      <Arrow
        points={[x - dx, y - dy, x, y]}
        fill="#facc15"
        stroke="#facc15"
        strokeWidth={2.5}
        pointerLength={10}
        pointerWidth={8}
      />
      <Text
        x={x - dx - 10}
        y={y - dy - 20}
        text={`${magnitude}kN`}
        fontSize={11}
        fill="#facc15"
        fontFamily="IBM Plex Mono, monospace"
      />
    </Group>
  );
}

// ─── Moment Arc ─────────────────────────────────────────────────────────
function MomentArc({ x, y, magnitude }) {
  const ccw = magnitude >= 0;
  return (
    <Group x={x} y={y}>
      <Arc
        innerRadius={20} outerRadius={24}
        angle={270}
        rotation={ccw ? -45 : 135}
        fill="#c084fc"
        strokeWidth={0}
      />
      <Text x={28} y={-10} text={`${Math.abs(magnitude)}kN·m`}
        fontSize={11} fill="#c084fc" fontFamily="IBM Plex Mono, monospace" />
    </Group>
  );
}

// ─── Reaction Overlay ────────────────────────────────────────────────────
function ReactionOverlay({ x, y, reactions }) {
  const entries = Object.entries(reactions);
  return (
    <Group x={x} y={y}>
      {entries.map(([comp, val], i) => {
        if (comp === 'Rx') {
          const len = Math.min(80, Math.max(30, Math.abs(val) * 4));
          const dir = val >= 0 ? 1 : -1;
          return (
            <Group key={comp}>
              <Arrow points={[dir * len, i * 0, 0, 0]} fill="#34d399" stroke="#34d399"
                strokeWidth={2.5} pointerLength={10} pointerWidth={8} dash={[4, 4]} />
              <Text x={dir * len + 5} y={-8} text={`Rx=${val}kN`}
                fontSize={10} fill="#34d399" fontFamily="IBM Plex Mono, monospace" />
            </Group>
          );
        }
        if (comp === 'Ry') {
          const len = Math.min(80, Math.max(30, Math.abs(val) * 4));
          const dir = val >= 0 ? -1 : 1;
          return (
            <Group key={comp}>
              <Arrow points={[0, dir * len, 0, 0]} fill="#34d399" stroke="#34d399"
                strokeWidth={2.5} pointerLength={10} pointerWidth={8} dash={[4, 4]} />
              <Text x={8} y={dir * len + 5} text={`Ry=${val}kN`}
                fontSize={10} fill="#34d399" fontFamily="IBM Plex Mono, monospace" />
            </Group>
          );
        }
        if (comp === 'M') {
          return (
            <Group key={comp}>
              <Arc innerRadius={22} outerRadius={26} angle={270} rotation={-45}
                fill="#34d399" strokeWidth={0} />
              <Text x={30} y={-8} text={`M=${val}kN·m`}
                fontSize={10} fill="#34d399" fontFamily="IBM Plex Mono, monospace" />
            </Group>
          );
        }
        return null;
      })}
    </Group>
  );
}

// ─── Modal for Force/Moment Input ───────────────────────────────────────
function InputModal({ title, fields, onConfirm, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.default || '']))
  );
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel rounded-xl p-6 w-80 animate-fadeIn shadow-2xl"
        style={{ border: '1px solid rgba(59,130,246,0.4)' }}>
        <h3 className="text-base font-semibold text-blue-300 mono mb-4">{title}</h3>
        {fields.map((f) => (
          <div key={f.key} className="mb-3">
            <label className="text-xs text-blue-400 mono block mb-1">{f.label}</label>
            <input
              type="number"
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full bg-[#070d1a] border border-blue-900 rounded-lg px-3 py-2 text-blue-100 mono text-sm focus:outline-none focus:border-blue-500"
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-blue-900 text-blue-400 text-sm hover:bg-blue-900/30 transition-colors mono">
            Cancel
          </button>
          <button onClick={() => onConfirm(values)}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors mono font-medium">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Canvas ─────────────────────────────────────────────────────────
export default function CanvasBoard({ width, height }) {
  const {
    system, mode, pendingMemberStart, solution,
    addNode, addMember, addSupport, addForce, addMoment,
    removeNode, removeMember, removeSupport, removeForce, removeMoment,
    setPendingMemberStart, setSelectedNodeId, selectedNodeId,
  } = useMechanicsStore();

  const [modal, setModal] = useState(null); // { type, nodeId }
  const [hoverPos, setHoverPos] = useState(null);
  const stageRef = useRef(null);

  // Draw grid lines
  const gridLines = [];
  for (let x = 0; x <= width; x += GRID) {
    const isMajor = x % (GRID * 5) === 0;
    gridLines.push(
      <Line key={`gx${x}`}
        points={[x, 0, x, height]}
        stroke={isMajor ? 'rgba(30,100,200,0.3)' : 'rgba(25,70,140,0.15)'}
        strokeWidth={isMajor ? 1 : 0.5} />
    );
  }
  for (let y = 0; y <= height; y += GRID) {
    const isMajor = y % (GRID * 5) === 0;
    gridLines.push(
      <Line key={`gy${y}`}
        points={[0, y, width, y]}
        stroke={isMajor ? 'rgba(30,100,200,0.3)' : 'rgba(25,70,140,0.15)'}
        strokeWidth={isMajor ? 1 : 0.5} />
    );
  }

  const handleStageClick = useCallback((e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const sx = snapToGrid(pos.x);
    const sy = snapToGrid(pos.y);
    const snapped = nearestNode(system.nodes, pos.x, pos.y);

    if (mode === 'addNode') {
      addNode(sx, sy);
      return;
    }

    if (mode === 'addMember') {
      if (snapped) {
        if (!pendingMemberStart) {
          setPendingMemberStart(snapped.id);
        } else {
          addMember(pendingMemberStart, snapped.id);
          setPendingMemberStart(null);
        }
      }
      return;
    }

    if (['addPin', 'addRoller', 'addFixed'].includes(mode)) {
      if (snapped) {
        const typeMap = { addPin: 'pin', addRoller: 'roller', addFixed: 'fixed' };
        addSupport(snapped.id, typeMap[mode]);
      }
      return;
    }

    if (mode === 'addForce') {
      if (snapped) {
        setModal({ type: 'force', nodeId: snapped.id });
      }
      return;
    }

    if (mode === 'addMoment') {
      if (snapped) {
        setModal({ type: 'moment', nodeId: snapped.id });
      }
      return;
    }
  }, [mode, pendingMemberStart, system.nodes, addNode, addMember, addSupport, setPendingMemberStart]);

  const handleMouseMove = useCallback((e) => {
    const pos = e.target.getStage().getPointerPosition();
    setHoverPos({ x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
  }, []);

  const getSupportForNode = (nodeId) =>
    system.supports.find((sp) => sp.nodeId === nodeId);

  const getNodeById = (id) => system.nodes.find((n) => n.id === id);

  return (
    <div className="relative w-full h-full">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        style={{ cursor: mode === 'addNode' ? 'crosshair' : mode === 'select' ? 'default' : 'pointer' }}
      >
        <Layer>
          {/* Grid */}
          {gridLines}

          {/* Origin axes */}
          <Arrow points={[20, height - 20, 70, height - 20]} fill="#3b82f6" stroke="#3b82f6" strokeWidth={1.5} pointerLength={6} pointerWidth={5} />
          <Text x={72} y={height - 26} text="X" fill="#3b82f6" fontSize={12} fontFamily="IBM Plex Mono" />
          <Arrow points={[20, height - 20, 20, height - 70]} fill="#3b82f6" stroke="#3b82f6" strokeWidth={1.5} pointerLength={6} pointerWidth={5} />
          <Text x={24} y={height - 76} text="Y" fill="#3b82f6" fontSize={12} fontFamily="IBM Plex Mono" />

          {/* Members */}
          {system.members.map((m) => {
            const s = getNodeById(m.startNodeId);
            const e = getNodeById(m.endNodeId);
            if (!s || !e) return null;
            const midX = (s.x + e.x) / 2;
            const midY = (s.y + e.y) / 2;
            const lenPx = Math.hypot(e.x - s.x, e.y - s.y);
            const lenUnits = (lenPx / GRID).toFixed(2);
            // Angle for rotating label along member direction
            const angle = Math.atan2(e.y - s.y, e.x - s.x) * 180 / Math.PI;
            return (
              <Group 
                key={m.id} 
                onClick={(e) => {
                  if (mode === 'delete') {
                    e.cancelBubble = true;
                    removeMember(m.id);
                  }
                }}
              >
                <Line
                  points={[s.x, s.y, e.x, e.y]}
                  stroke="#60a5fa"
                  strokeWidth={6} // Increased hit area
                  hitStrokeWidth={20}
                  strokeScaleEnabled={false}
                  lineCap="round"
                  opacity={mode === 'delete' ? 0.6 : 1}
                />
                <Line
                  points={[s.x, s.y, e.x, e.y]}
                  stroke={mode === 'delete' ? '#f87171' : '#60a5fa'}
                  strokeWidth={3}
                  lineCap="round"
                />
                {/* Midpoint dot */}
                <Circle x={midX} y={midY} radius={3} fill="#1d4ed8" stroke="#60a5fa" strokeWidth={1.5} />
                {/* Length label */}
                <Group x={midX} y={midY} rotation={angle > 90 || angle < -90 ? angle + 180 : angle}>
                  <Text
                    x={-20} y={-18}
                    text={`L=${lenUnits}u`}
                    fontSize={10}
                    fill="#3c6080"
                    fontFamily="IBM Plex Mono, monospace"
                    width={40}
                    align="center"
                  />
                </Group>
              </Group>
            );
          })}


          {/* Hover ghost — member preview */}
          {mode === 'addMember' && pendingMemberStart && hoverPos && (() => {
            const n = getNodeById(pendingMemberStart);
            if (!n) return null;
            return <Line points={[n.x, n.y, hoverPos.x, hoverPos.y]}
              stroke="#60a5fa" strokeWidth={1.5} dash={[6, 4]} opacity={0.5} />;
          })()}

          {/* Hover ghost — node preview */}
          {mode === 'addNode' && hoverPos && (
            <Circle x={hoverPos.x} y={hoverPos.y} radius={NODE_R}
              fill="rgba(96,165,250,0.3)" stroke="#60a5fa" strokeWidth={1.5} dash={[4, 3]} />
          )}

          {/* Forces */}
          {system.forces.map((f) => {
            const node = getNodeById(f.nodeId);
            if (!node) return null;
            return (
              <Group 
                key={f.id} 
                onClick={(e) => {
                  if (mode === 'delete') {
                    e.cancelBubble = true;
                    removeForce(f.id);
                  }
                }}
              >
                <ForceArrow x={node.x} y={node.y} magnitude={f.magnitude} angle={f.angle} />
              </Group>
            );
          })}

          {/* Moments */}
          {system.moments.map((mo) => {
            const node = getNodeById(mo.nodeId);
            if (!node) return null;
            return (
              <Group 
                key={mo.id} 
                onClick={(e) => {
                  if (mode === 'delete') {
                    e.cancelBubble = true;
                    removeMoment(mo.id);
                  }
                }}
              >
                <MomentArc x={node.x} y={node.y} magnitude={mo.magnitude} />
              </Group>
            );
          })}

          {/* Supports */}
          {system.supports.map((sp) => {
            const node = getNodeById(sp.nodeId);
            if (!node) return null;
            const SupportComp = sp.type === 'pin' ? PinSupport : sp.type === 'roller' ? RollerSupport : FixedSupport;
            return (
              <Group 
                key={sp.id} 
                onClick={(e) => {
                  if (mode === 'delete') {
                    e.cancelBubble = true;
                    removeSupport(sp.id);
                  }
                }}
              >
                <SupportComp x={node.x} y={node.y} />
              </Group>
            );
          })}

          {/* Nodes */}
          {system.nodes.map((n) => {
            const isSelected = selectedNodeId === n.id;
            const isPendingStart = pendingMemberStart === n.id;
            return (
              <Group
                key={n.id}
                onClick={(e) => {
                  e.cancelBubble = true;
                  // Dispatch action based on current toolbar mode
                  if (mode === 'addPin') {
                    addSupport(n.id, 'pin');
                  } else if (mode === 'addRoller') {
                    addSupport(n.id, 'roller');
                  } else if (mode === 'addFixed') {
                    addSupport(n.id, 'fixed');
                  } else if (mode === 'addForce') {
                    setModal({ type: 'force', nodeId: n.id });
                  } else if (mode === 'addMoment') {
                    setModal({ type: 'moment', nodeId: n.id });
                  } else if (mode === 'addMember') {
                    if (!pendingMemberStart) {
                      setPendingMemberStart(n.id);
                    } else if (pendingMemberStart !== n.id) {
                      addMember(pendingMemberStart, n.id);
                      setPendingMemberStart(null);
                    }
                  } else if (mode === 'delete') {
                    removeNode(n.id);
                  } else {
                    setSelectedNodeId(n.id);
                  }
                }}
              >
                {(isSelected || isPendingStart) && (
                  <Circle x={n.x} y={n.y} radius={NODE_R + 6}
                    fill="rgba(96,165,250,0.15)" stroke="#60a5fa" strokeWidth={1} />
                )}
                <Circle
                  x={n.x} y={n.y} radius={NODE_R}
                  fill={isPendingStart ? '#facc15' : '#1d4ed8'}
                  stroke={isPendingStart ? '#facc15' : '#60a5fa'}
                  strokeWidth={2.5}
                  shadowBlur={isSelected ? 12 : 4}
                  shadowColor="#3b82f6"
                />
                <Text x={n.x + 12} y={n.y - 14}
                  text={n.label}
                  fill="#7fa8d8"
                  fontSize={11}
                  fontFamily="IBM Plex Mono, monospace"
                />
                {/* Grid coordinate label */}
                <Text x={n.x + 12} y={n.y + 2}
                  text={`(${n.x / GRID}, ${-(n.y / GRID - Math.round(height / GRID / 2))})`}
                  fill="#3c6080"
                  fontSize={9}
                  fontFamily="IBM Plex Mono, monospace"
                />
              </Group>
            );
          })}

          {/* Reaction overlays */}
          {solution?.reactions &&
            Object.entries(solution.reactions).map(([nodeId, reacts]) => {
              const node = getNodeById(nodeId);
              if (!node) return null;
              return <ReactionOverlay key={nodeId} x={node.x} y={node.y} reactions={reacts} />;
            })}
        </Layer>
      </Stage>

      {/* Modal for Force/Moment */}
      {modal?.type === 'force' && (
        <InputModal
          title="⟶ Apply Force"
          fields={[
            { key: 'magnitude', label: 'Magnitude (kN)', placeholder: '10', default: '10' },
            { key: 'angle', label: 'Angle (° from +X, CCW)', placeholder: '-90', default: '-90' },
          ]}
          onConfirm={(v) => {
            addForce(modal.nodeId, parseFloat(v.magnitude), parseFloat(v.angle));
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'moment' && (
        <InputModal
          title="↺ Apply Moment"
          fields={[
            { key: 'magnitude', label: 'Magnitude (kN·m, +CCW)', placeholder: '20', default: '20' },
          ]}
          onConfirm={(v) => {
            addMoment(modal.nodeId, parseFloat(v.magnitude));
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
