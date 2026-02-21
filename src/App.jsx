import React, { useRef, useEffect, useState } from 'react';
import CanvasBoard from './components/CanvasBoard';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import useMechanicsStore from './store/mechanicsStore';
import { Zap, Grid3X3, Info } from 'lucide-react';

const MODE_HINTS = {
  select:    'Click a node to select it.',
  addNode:   'Click anywhere on the grid to place a node.',
  addMember: 'Click a start node, then an end node to draw a member.',
  addPin:    'Click an existing node to attach a Pin support (Rx, Ry).',
  addRoller: 'Click an existing node to attach a Roller support (Ry only).',
  addFixed:  'Click an existing node to attach a Fixed support (Rx, Ry, M).',
  addForce:  'Click a node to apply a force — enter magnitude & angle.',
  addMoment: 'Click a node to apply a moment — enter magnitude.',
};

export default function App() {
  const canvasContainerRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const { mode } = useMechanicsStore();

  useEffect(() => {
    const update = () => {
      if (canvasContainerRef.current) {
        const { width, height } = canvasContainerRef.current.getBoundingClientRect();
        setDims({ w: Math.floor(width), h: Math.floor(height) });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: '#070d1a', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-2 flex-shrink-0"
        style={{
          background: 'rgba(7,13,26,0.98)',
          borderBottom: '1px solid rgba(59,130,246,0.20)',
          boxShadow: '0 1px 0 rgba(59,130,246,0.05)',
          height: '48px',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', boxShadow: '0 0 14px rgba(59,130,246,0.5)' }}>
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold mono glow-text" style={{ color: '#60a5fa', letterSpacing: '0.08em' }}>
              BLUE<span style={{ color: '#93c5fd' }}>PRINT</span>.js
            </span>
            <span className="ml-2 text-[10px] mono" style={{ color: '#3c6080' }}>
              IIT Statics Solver · v1.0
            </span>
          </div>
        </div>

        {/* Mode Banner */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Grid3X3 size={11} style={{ color: '#60a5fa' }} />
          <span className="text-[11px] mono" style={{ color: '#60a5fa' }}>
            MODE: <strong>{mode.replace('add', '').toUpperCase()}</strong>
          </span>
        </div>

        {/* Hint */}
        <div className="flex items-center gap-2 text-[11px] mono" style={{ color: '#3c6080', maxWidth: '340px' }}>
          <Info size={11} className="flex-shrink-0" style={{ color: '#3c6080' }} />
          <span className="truncate">{MODE_HINTS[mode]}</span>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <div className="flex-1 blueprint-grid overflow-hidden" ref={canvasContainerRef}>
          <CanvasBoard width={dims.w} height={dims.h} />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
