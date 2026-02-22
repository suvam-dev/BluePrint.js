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
    set((s) => ({ system: { ...s.system, nodes: [...s.system.nodes, node] }, solution: null }));
    return node;
  },

  updateNodeCoords: (id, newX, newY) => {
    set((s) => ({
      system: {
        ...s.system,
        nodes: s.system.nodes.map(n => n.id === id ? { ...n, x: newX, y: newY } : n)
      },
      solution: null
    }));
  },

  addMember: (startNodeId, endNodeId) => {
    if (startNodeId === endNodeId) return;
    const member = createMember(uid(), startNodeId, endNodeId);
    set((s) => ({ system: { ...s.system, members: [...s.system.members, member] } }));
  },

  addMemberFixed: (startNodeId, lengthGrid, angleDeg) => {
    const GRID = 40;
    set((s) => {
      const startNode = s.system.nodes.find(n => n.id === startNodeId);
      if (!startNode) return s;
      
      const rad = (angleDeg * Math.PI) / 180;
      const lengthPx = lengthGrid * GRID;
      
      const newX = Math.round(startNode.x + Math.cos(rad) * lengthPx);
      // y points down in canvas, angles are measured CCW from +X
      const newY = Math.round(startNode.y - Math.sin(rad) * lengthPx);

      // Snap to existing node
      let endNode = s.system.nodes.find(n => Math.hypot(n.x - newX, n.y - newY) < 20);
      let newNodes = s.system.nodes;
      
      if (!endNode) {
        endNode = createNode(uid(), Math.round(newX/GRID)*GRID, Math.round(newY/GRID)*GRID); // snap to grid logic if needed, or just newX, newY. Let's use newX, newY but snapToGrid if we want it pixel perfect on grid.
        // Wait, start node is already snapped to grid. lengthGrid * GRID is integer multiple of GRID.
        // cos/sin could have float inaccuracies
        newX = Math.round(newX / GRID) * GRID;
        newY = Math.round(newY / GRID) * GRID;
        
        endNode = createNode(uid(), newX, newY);
        newNodes = [...newNodes, endNode];
      }
      
      if (startNodeId === endNode.id) return { system: { ...s.system, nodes: newNodes }, solution: null };
      
      const exists = s.system.members.some(
        m => (m.startNodeId === startNode.id && m.endNodeId === endNode.id) || 
             (m.startNodeId === endNode.id && m.endNodeId === startNode.id)
      );
      
      if (exists) return { system: { ...s.system, nodes: newNodes }, solution: null };

      const newMember = createMember(uid(), startNode.id, endNode.id);
      return { 
        system: { 
          ...s.system, 
          nodes: newNodes,
          members: [...s.system.members, newMember] 
        },
        solution: null
      };
    });
  },

  addRodDirectly: (startXGrid, startYGrid, lengthGrid, angleDeg) => {
    const GRID = 40;
    console.log("addRodDirectly called with:", {startXGrid, startYGrid, lengthGrid, angleDeg});
    set((s) => {
      const startNodeX = startXGrid * GRID;
      const startNodeY = -startYGrid * GRID;
      
      const rad = (angleDeg * Math.PI) / 180;
      const lengthPx = lengthGrid * GRID;
      
      const endNodeX = startNodeX + Math.cos(rad) * lengthPx;
      const endNodeY = startNodeY - Math.sin(rad) * lengthPx;

      console.log("Calculated internal coords:", {startNodeX, startNodeY, endNodeX, endNodeY});

      let n1 = s.system.nodes.find(n => Math.hypot(n.x - startNodeX, n.y - startNodeY) < 20);
      let n2 = s.system.nodes.find(n => Math.hypot(n.x - endNodeX, n.y - endNodeY) < 20);
      
      let newNodes = s.system.nodes;
      
      if (!n1) {
        console.log("Creating new n1");
        n1 = createNode(uid(), startNodeX, startNodeY);
        newNodes = [...newNodes, n1];
      }
      if (!n2) {
        console.log("Creating new n2");
        n2 = createNode(uid(), endNodeX, endNodeY);
        newNodes = [...newNodes, n2];
      }
      
      if (n1.id === n2.id) return s;
      
      const exists = s.system.members.some(
        m => (m.startNodeId === n1.id && m.endNodeId === n2.id) || 
             (m.startNodeId === n2.id && m.endNodeId === n1.id)
      );
      
      if (exists) return { system: { ...s.system, nodes: newNodes }, solution: null };
      
      const newMember = createMember(uid(), n1.id, n2.id);
      return {
        system: { ...s.system, nodes: newNodes, members: [...s.system.members, newMember] },
        solution: null
      };
    });
  },

  updateMemberPolar: (memberId, lengthGrid, angleDeg) => {
    const GRID = 40;
    set((s) => {
      const member = s.system.members.find(m => m.id === memberId);
      if (!member) return s;
      
      const startNode = s.system.nodes.find(n => n.id === member.startNodeId);
      const endNode = s.system.nodes.find(n => n.id === member.endNodeId);
      if (!startNode || !endNode) return s;
      
      const rad = (angleDeg * Math.PI) / 180;
      const lengthPx = lengthGrid * GRID;
      
      const newX = startNode.x + Math.cos(rad) * lengthPx;
      const newY = startNode.y - Math.sin(rad) * lengthPx;
      
      const newNodes = s.system.nodes.map(n => 
        n.id === endNode.id ? { ...n, x: newX, y: newY } : n
      );
      
      return {
        system: { ...s.system, nodes: newNodes },
        solution: null
      };
    });
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
