/**
 * Cube geometry shared by the 3D view and the 2D net.
 *
 * The sticker layout is the classic unfolded net that the Rust solver also
 * uses, so a sticker index means exactly the same thing on both sides:
 *
 * ```text
 *              U0 U1 U2
 *              U3 U4 U5
 *              U6 U7 U8
 *   L0 L1 L2   F0 F1 F2   R0 R1 R2   B0 B1 B2
 *   L3 L4 L5   F3 F4 F5   R3 R4 R5   B3 B4 B5
 *   L6 L7 L8   F6 F7 F8   R6 R7 R8   B6 B7 B8
 *              D0 D1 D2
 *              D3 D4 D5
 *              D6 D7 D8
 * ```
 *
 * Facelet index = `face * 9 + row * 3 + column`, and the faces are ordered
 * `U, R, F, D, L, B`, which is the order the solver's facelet string uses.
 */

/** Face identifiers, in facelet string order. */
export const FACE_U = 0;
export const FACE_R = 1;
export const FACE_F = 2;
export const FACE_D = 3;
export const FACE_L = 4;
export const FACE_B = 5;

/** Identifier of a face of the cube. */
export type FaceId = 0 | 1 | 2 | 3 | 4 | 5;

/** Sticker value used while a sticker has not been painted yet. */
export const UNKNOWN_STICKER = 6;

/** A point or direction on the integer grid. */
export type Vec3 = readonly [number, number, number];

/** A colour of the cube, plus how to draw and talk about it. */
export interface FaceColor {
	readonly id: FaceId;
	/** Face letter used by the facelet string. */
	readonly letter: string;
	/** Human readable colour, used in tooltips. */
	readonly name: string;
	/** The net's middle sticker always shows this face. */
	readonly css: string;
}

/**
 * The standard western colour scheme: white up, yellow down, green front, blue
 * back, red right, orange left.
 */
export const FACE_COLORS: readonly FaceColor[] = [
	{ id: FACE_U, letter: 'U', name: 'White', css: '#f4f4f5' },
	{ id: FACE_R, letter: 'R', name: 'Red', css: '#c4302b' },
	{ id: FACE_F, letter: 'F', name: 'Green', css: '#1d9e50' },
	{ id: FACE_D, letter: 'D', name: 'Yellow', css: '#f2c300' },
	{ id: FACE_L, letter: 'L', name: 'Orange', css: '#e8721c' },
	{ id: FACE_B, letter: 'B', name: 'Blue', css: '#2159c4' }
];

/** Colour shown for a sticker that has not been painted yet. */
export const UNKNOWN_CSS = '#33363d';
/** Colour of the (hidden) inside faces of the sub cubes. */
export const INTERIOR_CSS = '#111214';

/** Colour of a sticker as a CSS value. */
export function stickerCss(sticker: number): string {
	return FACE_COLORS[sticker]?.css ?? UNKNOWN_CSS;
}

/** Colour of a sticker as a 0xRRGGBB number, for three.js materials. */
export function stickerHex(sticker: number | null): number {
	if (sticker === null || sticker >= FACE_COLORS.length) {
		return sticker === null ? 0x111214 : 0x33363d;
	}
	return Number.parseInt(FACE_COLORS[sticker].css.slice(1), 16);
}

const NX: Vec3 = [-1, 0, 0];
const PX: Vec3 = [1, 0, 0];
const NY: Vec3 = [0, -1, 0];
const PY: Vec3 = [0, 1, 0];
const NZ: Vec3 = [0, 0, -1];
const PZ: Vec3 = [0, 0, 1];

/** The six normals in the order three.js' `BoxGeometry` groups its materials. */
export const BOX_FACE_NORMALS: readonly Vec3[] = [PX, NX, PY, NY, PZ, NZ];

/** Geometry of a single sticker. */
export interface StickerInfo {
	/** Facelet index, `0..53`. */
	readonly index: number;
	/** Centre of the sub cube this sticker belongs to. */
	readonly position: Vec3;
	/** Outward normal, i.e. which way the sticker faces. */
	readonly normal: Vec3;
	/** Face the sticker belongs to. */
	readonly face: FaceId;
}

/**
 * Grid point and outward normal of the sticker at `(face, row, column)`.
 *
 * The net is drawn as `L F R B` around the middle band with `U` above `F` and
 * `D` below it, so columns run `x: -1 -> +1` on `U`, `F` and `D` (mirrored on
 * `B`), the band runs `z: +1 -> -1` from front to back, and rows run
 * `y: +1 -> -1`.
 */
function stickerGeometry(face: FaceId, row: number, column: number): { position: Vec3; normal: Vec3 } {
	const c = column - 1;
	const r = 1 - row;
	switch (face) {
		case FACE_U:
			return { position: [c, 1, -r], normal: PY };
		case FACE_R:
			return { position: [1, r, -c], normal: PX };
		case FACE_F:
			return { position: [c, r, 1], normal: PZ };
		case FACE_D:
			return { position: [c, -1, r], normal: NY };
		case FACE_L:
			return { position: [-1, r, c], normal: NX };
		default:
			return { position: [-c, r, -1], normal: NZ };
	}
}

/** All 54 stickers, indexed the same way as the solver's facelet string. */
export const STICKERS: readonly StickerInfo[] = (() => {
	const stickers: StickerInfo[] = [];
	for (let face = 0; face < 6; face++) {
		for (let row = 0; row < 3; row++) {
			for (let column = 0; column < 3; column++) {
				const { position, normal } = stickerGeometry(face as FaceId, row, column);
				stickers.push({ index: face * 9 + row * 3 + column, position, normal, face: face as FaceId });
			}
		}
	}
	return stickers;
})();

const stickerKey = (position: Vec3, normal: Vec3) => `${position.join(',')}|${normal.join(',')}`;

const STICKER_LOOKUP: ReadonlyMap<string, number> = new Map(
	STICKERS.map((sticker) => [stickerKey(sticker.position, sticker.normal), sticker.index])
);

/** Facelet index of the sticker sitting on `position` and facing `normal`. */
export function stickerIndexAt(position: Vec3, normal: Vec3): number | undefined {
	return STICKER_LOOKUP.get(stickerKey(position, normal));
}


/** A 3x3 matrix in row-major order. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/** Matrix with the given three vectors as its *columns*. */
function fromColumns(c0: Vec3, c1: Vec3, c2: Vec3): Mat3 {
	return [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
}

function transpose3(m: Mat3): Mat3 {
	return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

function multiply3(a: Mat3, b: Mat3): Mat3 {
	const out = new Array<number>(9).fill(0);
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			out[row * 3 + col] =
				a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
		}
	}
	return out as unknown as Mat3;
}

/** Apply a matrix to a vector, rounding floating point noise away. */
export function applyMat3(m: Mat3, v: Vec3): Vec3 {
	return [
		Math.round(m[0] * v[0] + m[1] * v[1] + m[2] * v[2]),
		Math.round(m[3] * v[0] + m[4] * v[1] + m[5] * v[2]),
		Math.round(m[6] * v[0] + m[7] * v[1] + m[8] * v[2])
	];
}

function cross(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** A corner or an edge slot of the cube. */
export interface SlotInfo {
	/** Name such as `URF` or `FR`. */
	readonly name: string;
	/** Centre of the sub cube sitting in this slot. */
	readonly position: Vec3;
	/** Sticker normals, in the order of the slot's facelets. */
	readonly normals: readonly Vec3[];
	/** Facelet indices of the slot's stickers. */
	readonly facelets: readonly number[];
	/** Colours of the slot's stickers on a solved cube. */
	readonly solvedColors: readonly FaceId[];
}

function makeSlot(name: string, position: Vec3, normals: readonly Vec3[]): SlotInfo {
	const facelets = normals.map((normal) => {
		const index = stickerIndexAt(position, normal);
		if (index === undefined) {
			throw new Error(`cube geometry is inconsistent at ${name} facing ${normal.join(',')}`);
		}
		return index;
	});
	return { name, position, normals, facelets, solvedColors: normals.map(faceOfNormal) };
}

/** Face a signed unit normal points at. */
export function faceOfNormal(normal: Vec3): FaceId {
	if (normal[0] === 1) return FACE_R;
	if (normal[0] === -1) return FACE_L;
	if (normal[1] === 1) return FACE_U;
	if (normal[1] === -1) return FACE_D;
	if (normal[2] === 1) return FACE_F;
	return FACE_B;
}

/**
 * The eight corners, in solver order `URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB`.
 * The normal order defines a corner's orientation, exactly like `CORNERS` does
 * in the Rust crate.
 */
export const CORNER_SLOTS: readonly SlotInfo[] = [
	makeSlot('URF', [1, 1, 1], [PY, PX, PZ]),
	makeSlot('UFL', [-1, 1, 1], [PY, PZ, NX]),
	makeSlot('ULB', [-1, 1, -1], [PY, NX, NZ]),
	makeSlot('UBR', [1, 1, -1], [PY, NZ, PX]),
	makeSlot('DFR', [1, -1, 1], [NY, PZ, PX]),
	makeSlot('DLF', [-1, -1, 1], [NY, NX, PZ]),
	makeSlot('DBL', [-1, -1, -1], [NY, NZ, NX]),
	makeSlot('DRB', [1, -1, -1], [NY, PX, NZ])
];


/** Where a cubie sits and how it is turned. */
export interface CubiePlacement {
	/** Which slot the cubie occupies. */
	readonly slot: number;
	/** Which cubie it is, in solver order. */
	readonly cubie: number;
	/** Position of the sub cube on the integer grid. */
	readonly position: Vec3;
	/** Rotation mapping the cubie's home frame onto the cube. */
	readonly rotation: Mat3;
	/** Set when the sticker colours were not enough to pin the cubie down. */
	readonly uncertain: boolean;
}

/** Placements of all 20 cubies of a cube state. */
export interface CubePlacements {
	readonly corners: readonly CubiePlacement[];
	readonly edges: readonly CubiePlacement[];
}

const PERMUTATIONS_3: readonly (readonly number[])[] = [
	[0, 1, 2],
	[1, 2, 0],
	[2, 0, 1],
	[0, 2, 1],
	[1, 0, 2],
	[2, 1, 0]
];
const PERMUTATIONS_2: readonly (readonly number[])[] = [
	[0, 1],
	[1, 0]
];

/**
 * Work out which cubie sits in `slot` and how it is turned, from the colours of
 * its stickers.
 *
 * Unpainted stickers match anything, so a half painted cube still gets a
 * sensible placement; `uncertain` reports that the colours were ambiguous.
 */
function findCubie(
	isCorner: boolean,
	slot: number,
	colors: readonly number[]
): { cubie: number; orientation: readonly number[]; uncertain: boolean } {
	const slots = isCorner ? CORNER_SLOTS : EDGE_SLOTS;
	const size = isCorner ? 3 : 2;
	const permutations = isCorner ? PERMUTATIONS_3 : PERMUTATIONS_2;
	const observed = slots[slot].facelets.map((facelet) => colors[facelet]);

	let best = { cubie: 0, orientation: permutations[0], matches: -1 };
	for (let cubie = 0; cubie < slots.length; cubie++) {
		const solved = slots[cubie].solvedColors;
		for (const permutation of permutations) {
			let matches = 0;
			let possible = true;
			for (let j = 0; j < size; j++) {
				const seen = observed[permutation[j]];
				if (seen === undefined || seen === UNKNOWN_STICKER) continue;
				if (seen !== solved[j]) {
					possible = false;
					break;
				}
				matches++;
			}
			if (!possible) continue;
			// Prefer the cubie explaining the most stickers; ties go to the
			// lowest cubie index so the result is deterministic.
			if (matches > best.matches) {
				best = { cubie, orientation: permutation, matches };
			}
		}
	}
	return { cubie: best.cubie, orientation: best.orientation, uncertain: best.matches < size };
}

/** Build the placement of every cubie from the 54 sticker colours. */
export function placementsFromColors(colors: readonly number[]): CubePlacements {
	const build = (isCorner: boolean): CubiePlacement[] => {
		const slots = isCorner ? CORNER_SLOTS : EDGE_SLOTS;
		return slots.map((slot, index) => {
			const { cubie, orientation, uncertain } = findCubie(isCorner, index, colors);
			const home = slots[cubie];
			const homeBasis = isCorner
				? fromColumns(home.normals[0], home.normals[1], home.normals[2])
				: fromColumns(home.normals[0], home.normals[1], cross(home.normals[0], home.normals[1]));
			const slotBasis = isCorner
				? fromColumns(
						slot.normals[orientation[0]],
						slot.normals[orientation[1]],
						slot.normals[orientation[2]]
					)
				: fromColumns(
						slot.normals[orientation[0]],
						slot.normals[orientation[1]],
						cross(slot.normals[orientation[0]], slot.normals[orientation[1]])
					);
			// `slot = rotation * home`, so the mesh must be rotated by exactly
			// that rotation to show the right stickers on the right faces.
			const rotation = multiply3(slotBasis, transpose3(homeBasis));
			return { slot: index, cubie, position: slot.position, rotation, uncertain };
		});
	};
	return { corners: build(true), edges: build(false) };
}

/**
 * Material colours of a cubie, in three.js' `BoxGeometry` material order
 * `+x, -x, +y, -y, +z, -z`.
 *
 * Three outcomes per face:
 *
 * * a sticker colour id (`0..5`) when the face carries a painted sticker,
 * * [`UNKNOWN_STICKER`] when it carries a sticker that has not been painted yet,
 * * `null` when the face is inside the cube and has no sticker at all.
 *
 * Unpainted and inside are deliberately different: the first is drawn as an
 * empty sticker, the second as the dark interior of the cube. Collapsing them
 * makes unpainted stickers look like holes in the cube.
 *
 * Colours are read straight out of the cube state, so this must be called
 * together with a placement sync: a mesh only shows the right colours while it
 * sits in the slot the placement describes.
 */
export function cubieFaceColors(
	placement: Pick<CubiePlacement, 'position' | 'rotation'>,
	colors: readonly number[]
): (number | null)[] {
	return BOX_FACE_NORMALS.map((localNormal) => {
		const worldNormal = applyMat3(placement.rotation, localNormal);
		const index = stickerIndexAt(placement.position, worldNormal);
		if (index === undefined) return null;
		const sticker = colors[index];
		if (sticker === undefined) return null;
		return sticker < FACE_COLORS.length ? sticker : UNKNOWN_STICKER;
	});
}

/**
 * The twelve edges, in solver order
 * `UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR`.
 */
export const EDGE_SLOTS: readonly SlotInfo[] = [
	makeSlot('UR', [1, 1, 0], [PY, PX]),
	makeSlot('UF', [0, 1, 1], [PY, PZ]),
	makeSlot('UL', [-1, 1, 0], [PY, NX]),
	makeSlot('UB', [0, 1, -1], [PY, NZ]),
	makeSlot('DR', [1, -1, 0], [NY, PX]),
	makeSlot('DF', [0, -1, 1], [NY, PZ]),
	makeSlot('DL', [-1, -1, 0], [NY, NX]),
	makeSlot('DB', [0, -1, -1], [NY, NZ]),
	makeSlot('FR', [1, 0, 1], [PZ, PX]),
	makeSlot('FL', [-1, 0, 1], [PZ, NX]),
	makeSlot('BL', [-1, 0, -1], [NZ, NX]),
	makeSlot('BR', [1, 0, -1], [NZ, PX])
];
