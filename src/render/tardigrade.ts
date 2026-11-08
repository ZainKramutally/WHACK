// Easter egg (worlds/lead.ts): every animal is drawn as one fixed tardigrade, whatever the sim's genes say. Render-only.
import { LOCOMOTION, type BodyPlan } from '../sim/develop';

export function tardigradePlan(p: BodyPlan): BodyPlan {
  const scale = 2;   // metres drawn: the same for every animal, as in the founders' display size
  return {
    ...p,
    scale, chemistry: 'carbon', architecture: 'axial', symmetry: 2, segmentCount: 5, sides: 12, flatShaded: false, profile: 'smooth',
    tiers: 0, hubRadius: 0, tierHeight: 0, tierRadii: [], arms: [], curl: 0.05, bodyJointMaxDeg: 15, jointSnapDeg: 0,
    legPairs: 4, limbKind: 'leg', limbLength: scale * 0.18, limbSegments: 2, limbJointAngles: [25, -25],
    shellCover: 0, plateCover: 0, hornCount: 0, hornLength: 0, hornKind: 'none', dorsal: 'rods', gapeSize: scale * 0.1,
    girth: 1.5, flatten: 1, headScale: 0.9, gradient: 0, carapace: 0, crest: 0, jaw: 0, tailKind: 'none', tailSegments: 0, finSpan: 0, wingSpan: 0, liftSpan: 0,
    hue: 0.1, accent: 0, bands: 0, spots: 0, eyeKind: 'none', eyeCount: 0, glow: 0, mode: LOCOMOTION.walk,
  };
}
