// Animation clips as plain data, so the native renderer (Kotlin, GLES) can load the same clips the web view plays. A clip is a name, a length in seconds and a list of tracks;
// each track is one bone's rotation (quaternions, x y z w) or position (x y z) at a list of times. Nothing here is a Three.js object once it is saved.
const T = window.THREE;
const r5 = v => Math.round(v * 1e5) / 1e5;
export function clipToData(clip) {
  return { name: clip.name, duration: Math.round(clip.duration * 1e4) / 1e4, tracks: clip.tracks.map(t => { const dot = t.name.lastIndexOf('.'); return { bone: t.name.slice(0, dot), path: t.name.slice(dot + 1) === 'quaternion' ? 'rotation' : 'translation', times: Array.from(t.times, r5), values: Array.from(t.values, r5) }; }) };
}
export function dataToClip(d) {
  return new T.AnimationClip(d.name, d.duration, d.tracks.map(t => (t.path === 'rotation' ? new T.QuaternionKeyframeTrack(t.bone + '.quaternion', t.times, t.values) : new T.VectorKeyframeTrack(t.bone + '.position', t.times, t.values))));
}
