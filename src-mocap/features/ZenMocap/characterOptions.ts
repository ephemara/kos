/**
 * Character registry for ZenMocap.
 * Keep launcher + viewport in sync by sourcing options from one place.
 */
export const CHARACTER_OPTIONS = [
  {
    id: 'mixamo_bot',
    label: 'Mixamo Y-Bot',
    retargetUrl: '/resources/assets/meshes/MixamoBot_retarget.json',
  },
  {
    id: 'ue5_manny',
    label: 'UE5 Manny',
    retargetUrl: '/resources/assets/meshes/UE5Manny_retarget.json',
  },
] as const;

export type CharacterId = typeof CHARACTER_OPTIONS[number]['id'];
