// The gate has no beacon any more: no tall column or rings over it. The gate is found by the red wind streaks (view/threads.js) that start about 90 m out, and by the fog of war on the map.
// This stays as an empty group so the places that add and update the old seal need no change.
const T = window.THREE;
export function buildGateSeal(map, look) {
  const g = new T.Group(); g.userData.update = () => {}; return g;
}
