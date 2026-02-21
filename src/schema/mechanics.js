/**
 * mechanics.js — Central JSON Schema (System Object)
 *
 * SystemObject = {
 *   nodes:    Node[]
 *   members:  Member[]
 *   supports: Support[]
 *   forces:   Force[]
 *   moments:  Moment[]
 * }
 *
 * Node    { id, x, y, label }
 * Member  { id, startNodeId, endNodeId }
 * Support { id, nodeId, type: 'pin'|'roller'|'fixed', rollerDir: 'horizontal'|'vertical' }
 * Force   { id, nodeId, magnitude, angle }   // angle in degrees CCW from +X axis
 * Moment  { id, nodeId, magnitude }           // positive = CCW
 */

export const createNode = (id, x, y) => ({
  id,
  x,
  y,
  label: `N${id}`,
});

export const createMember = (id, startNodeId, endNodeId) => ({
  id,
  startNodeId,
  endNodeId,
});

export const createSupport = (id, nodeId, type, rollerDir = 'vertical') => ({
  id,
  nodeId,
  type,       // 'pin' | 'roller' | 'fixed'
  rollerDir,  // only for roller: which direction it is free to move
});

export const createForce = (id, nodeId, magnitude, angle) => ({
  id,
  nodeId,
  magnitude,  // kN
  angle,      // degrees CCW from +X
});

export const createMoment = (id, nodeId, magnitude) => ({
  id,
  nodeId,
  magnitude,  // kN·m, positive = CCW
});

export const emptySystem = () => ({
  nodes: [],
  members: [],
  supports: [],
  forces: [],
  moments: [],
});
