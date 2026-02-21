import { create } from 'zustand';
import {
  createNode, createMember, createSupport,
  createForce, createMoment, emptySystem,
} from '../schema/mechanics';

let _id = 1;
const uid = () => String(_id++);

const useMechanicsStore = create((set, get) => ({
  // ─── System Object ────────────────────────────────────────────────
  system: emptySystem(),

  // ─── UI State ─────────────────────────────────────────────────────
  mode: 'select',           // 'select' | 'addNode' | 'addMember' | 'addPin' | 'addRoller' | 'addFixed' | 'addForce' | 'addMoment'
  pendingMemberStart: null, // nodeId of first click when drawing member
  selectedNodeId: null,
  solution: null,           // { [nodeId]: { Rx?, Ry?, M? } }
  solveError: null,

  // ─── Actions ──────────────────────────────────────────────────────
  setMode: (mode) => set({ mode, pendingMemberStart: null, selectedNodeId: null }),

  addNode: (x, y) => {
    const node = createNode(uid(), x, y);
    set((s) => ({ system: { ...s.system, nodes: [...s.system.nodes, node] } }));
    return node;
  },

  addMember: (startNodeId, endNodeId) => {
    if (startNodeId === endNodeId) return;
    const member = createMember(uid(), startNodeId, endNodeId);
    set((s) => ({ system: { ...s.system, members: [...s.system.members, member] } }));
  },

  addSupport: (nodeId, type) => {
    // Remove existing support on same node first
    const support = createSupport(uid(), nodeId, type);
    set((s) => ({
      system: {
        ...s.system,
        supports: [
          ...s.system.supports.filter((sp) => sp.nodeId !== nodeId),
          support,
        ],
      },
    }));
  },

  addForce: (nodeId, magnitude, angle) => {
    const force = createForce(uid(), nodeId, magnitude, angle);
    set((s) => ({ system: { ...s.system, forces: [...s.system.forces, force] } }));
  },

  addMoment: (nodeId, magnitude) => {
    const moment = createMoment(uid(), nodeId, magnitude);
    set((s) => ({ system: { ...s.system, moments: [...s.system.moments, moment] } }));
  },

  removeNode: (nodeId) => {
    set((s) => ({
      system: {
        nodes: s.system.nodes.filter((n) => n.id !== nodeId),
        members: s.system.members.filter(
          (m) => m.startNodeId !== nodeId && m.endNodeId !== nodeId
        ),
        supports: s.system.supports.filter((sp) => sp.nodeId !== nodeId),
        forces: s.system.forces.filter((f) => f.nodeId !== nodeId),
        moments: s.system.moments.filter((mo) => mo.nodeId !== nodeId),
      },
    }));
  },

  removeMember: (memberId) => {
    set((s) => ({
      system: {
        ...s.system,
        members: s.system.members.filter((m) => m.id !== memberId),
      },
    }));
  },

  removeSupport: (supportId) => {
    set((s) => ({
      system: {
        ...s.system,
        supports: s.system.supports.filter((sp) => sp.id !== supportId),
      },
    }));
  },

  removeForce: (forceId) => {
    set((s) => ({
      system: {
        ...s.system,
        forces: s.system.forces.filter((f) => f.id !== forceId),
      },
    }));
  },

  removeMoment: (momentId) => {
    set((s) => ({
      system: {
        ...s.system,
        moments: s.system.moments.filter((mo) => mo.id !== momentId),
      },
    }));
  },

  setPendingMemberStart: (nodeId) => set({ pendingMemberStart: nodeId }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setSolution: (sol) => set({ solution: sol, solveError: null }),
  setSolveError: (err) => set({ solveError: err, solution: null }),
  clearSolution: () => set({ solution: null, solveError: null }),

  clearAll: () => {
    _id = 1;
    set({ system: emptySystem(), solution: null, solveError: null, mode: 'select' });
  },
}));

export default useMechanicsStore;
