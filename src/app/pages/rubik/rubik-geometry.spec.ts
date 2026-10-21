import { cubieFaceColors, placementsFromColors, UNKNOWN_STICKER } from './rubik-geometry';

function det(m: readonly number[]): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

function solvedColors(): number[] {
  const colors: number[] = [];
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 9; k++) colors.push(face);
  }
  return colors;
}

describe('rubik geometry', () => {
  it('shows a sticker on all three outward faces of every corner', () => {
    const colors = solvedColors();
    const placements = placementsFromColors(colors);
    for (const placement of placements.corners) {
      const faces = cubieFaceColors(placement, colors).filter((value) => value !== null);
      expect(faces).toHaveLength(3);
    }
  });

  it('keeps every rotation proper while a cube is only partly painted', () => {
    const base = solvedColors();
    for (let attempt = 0; attempt < 500; attempt++) {
      const colors = base.map((color) => (Math.random() < 0.5 ? color : UNKNOWN_STICKER));
      const placements = placementsFromColors(colors);
      for (const placement of [...placements.corners, ...placements.edges]) {
        // A reflection cannot be represented by a quaternion: three.js would
        // turn it into a different rotation and show black interior faces.
        expect(det(placement.rotation)).toBe(1);
      }
    }
  });

  it('does not turn a corner black when its painted colours look reflected', () => {
    // Swap the U and F stickers of the URF corner.  The old search accepted the
    // odd permutation that matched those two colours, which made the corner's
    // rotation a reflection and left black faces pointing outwards.
    const colors = solvedColors();
    colors[8] = 2; // URF's U sticker painted green
    colors[20] = 0; // URF's F sticker painted white

    const placement = placementsFromColors(colors).corners[0];
    expect(det(placement.rotation)).toBe(1);
    expect(cubieFaceColors(placement, colors).filter((value) => value !== null)).toHaveLength(3);
  });
});
