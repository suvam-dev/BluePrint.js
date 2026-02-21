import React from 'react';
import {
  MousePointer2, Plus, Minus, Triangle, Circle, Square,
  ArrowDown, RotateCcw, Trash2, Zap, ChevronRight
} from 'lucide-react';
import useMechanicsStore from '../store/mechanicsStore';

const TOOLS = [
  {
    group: 'Canvas',
    items: [
      { id: 'select',    label: 'Select',     icon: MousePointer2, color: '#60a5fa' },
      { id: 'addNode',   label: 'Add Node',   icon: Plus,          color: '#60a5fa' },
      { id: 'delete',    label: 'Delete',     icon: Trash2,        color: '#f87171' },
    ],
  },
  {
    group: 'Members',
    items: [
      { id: 'addMember', label: 'Draw Member', icon: Minus, color: '#60a5fa' },
    ],
  },
  {
    group: 'Supports',
    items: [
      { id: 'addPin',    label: 'Pin',    icon: Triangle, color: '#60a5fa' },
      { id: 'addRoller', label: 'Roller', icon: Circle,   color: '#34d399' },
      { id: 'addFixed',  label: 'Fixed',  icon: Square,   color: '#fb923c' },
    ],
  },
  {
    group: 'Loads',
    items: [
      { id: 'addForce',  label: 'Force',   icon: ArrowDown, color: '#facc15' },
      { id: 'addMoment', label: 'Moment',  icon: RotateCcw, color: '#c084fc' },
    ],
  },
];

export default function Toolbar() {
  const { mode, setMode, clearAll } = useMechanicsStore();

  return (
    <div
      className="flex flex-col gap-1 py-4 px-2 h-full overflow-y-auto"
      style={{
        background: 'rgba(7,13,26,0.95)',
        borderRight: '1px solid rgba(59,130,246,0.15)',
        width: '72px',
      }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-1"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', boxShadow: '0 0 16px rgba(59,130,246,0.4)' }}>
          <Zap size={18} className="text-white" />
        </div>
        <span className="text-[8px] mono text-blue-500 leading-tight text-center">BLUE<br />PRINT</span>
      </div>

      {TOOLS.map((group) => (
        <div key={group.group} className="flex flex-col gap-1 mb-2">
          <span className="text-[8px] mono text-center mb-1"
            style={{ color: 'rgba(96,165,250,0.4)', letterSpacing: '0.08em' }}>
            {group.group.toUpperCase()}
          </span>
          {group.items.map((tool) => {
            const Icon = tool.icon;
            const active = mode === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setMode(tool.id)}
                title={tool.label}
                className="relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-150 group"
                style={{
                  background: active
                    ? `rgba(59,130,246,0.2)`
                    : 'transparent',
                  border: active
                    ? `1px solid ${tool.color}60`
                    : '1px solid transparent',
                  boxShadow: active ? `0 0 12px ${tool.color}30` : 'none',
                }}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                    style={{ background: tool.color }} />
                )}
                <Icon size={16} style={{ color: active ? tool.color : '#3c6080' }} />
                <span className="text-[8px] mt-1 mono leading-tight"
                  style={{ color: active ? tool.color : '#3c6080' }}>
                  {tool.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      <div className="flex-1" />

      {/* Clear */}
      <button
        onClick={clearAll}
        title="Clear All"
        className="flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-150 hover:bg-red-900/20"
        style={{ border: '1px solid transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        <Trash2 size={16} style={{ color: '#4a2020' }} />
        <span className="text-[8px] mt-1 mono" style={{ color: '#4a2020' }}>Clear</span>
      </button>
    </div>
  );
}
