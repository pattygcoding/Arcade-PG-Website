/**
 * Bridge to the Rust/WebAssembly solving engine.
 *
 * The module is `wasm-pack build --target web` output, served from the public
 * folder next to its binary the way Alkalab's glue is, and loaded lazily so the
 * `.wasm` is only fetched when the page is opened.
 *
 * Everything that has to agree between the solver and the UI lives in Rust: what
 * a move does, which sticker sits where, and how a facelet string is laid out.
 * This file only adapts types and errors.
 */

import { UNKNOWN_STICKER } from './rubix-geometry';

/**
 * The wasm-bindgen glue in `public/wasm/`, next to
 * `rubix_wasm_solver_bg.wasm`.  Both keep the names `wasm-pack` gives them, so a
 * rebuilt engine can be dropped in without editing anything.
 */
const MODULE_URL = '/wasm/rubix_wasm_solver.js';

/** The solved cube, in the solver's facelet string order `U R F D L B`. */
export const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** The facelet letters, indexed by sticker colour. */
const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/** Character used in a facelet string for a sticker that is not painted yet. */
const UNKNOWN_LETTER = '?';

/** A loaded, ready to use solver. */
export interface SolverBridge {
  /** Version string of the Rust crate. */
  readonly version: string;
  /** Bytes of lookup tables the engine is holding, filled in by `warmUp`. */
  tableBytes: number;
  /** The solved facelet string the engine was built for. */
  readonly solvedFacelets: string;
  /** Solve a cube, returning a space separated Singmaster move list. */
  solve(facelets: string, maxDepth: number): string;
  /** Apply a move list to a facelet string. */
  applyMoves(facelets: string, moves: string): string;
  /** Is this facelet string a solved cube? */
  isSolved(facelets: string): boolean;
  /**
   * The first thing that stops this cube from being solved, or `null` when it
   * is solvable.  Never searches, so it is cheap enough to call on every paint.
   */
  validationError(facelets: string): string | null;
  /** For each sticker of the moved cube, the sticker it came from. */
  moveIndices(moves: string): Uint8Array;
  /** Move index of a Singmaster token such as `"R2"`, or `undefined`. */
  moveIndex(token: string): number | undefined;
  /** `[axis, layer, quarterTurns]` of a move, for the 3D animation. */
  moveTurn(moveIndex: number): [number, number, number] | null;
  /** Build every lookup table now, so the first solve is instant. */
  warmUp(): void;
}

/** Shape of the generated module as `public/wasm/rubix_wasm_solver.js` exports it. */
interface RubixModule {
  default(): Promise<{ memory: WebAssembly.Memory }>;
  solver_version(): string;
  solved_facelets(): string;
  solve_cube(facelets: string, maxDepth: number): string;
  js_apply_moves(facelets: string, moves: string): string;
  js_is_solved(facelets: string): boolean;
  js_validation_error(facelets: string): string | undefined;
  js_move_indices(moves: string): Uint8Array;
  move_index(token: string): number | undefined;
  move_turn(moveIndex: number): Int8Array;
  warm_up(): void;
  table_bytes(): number;
}

let bridgePromise: Promise<SolverBridge> | null = null;
let bridge: SolverBridge | null = null;

/** The solver, if it has finished loading. */
export function getSolver(): SolverBridge | null {
  return bridge;
}

/** Turn whatever Rust threw into a readable message. */
export function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Load and instantiate the WebAssembly module.
 *
 * The promise is cached, so calling this from several components is free.
 *
 * The glue is loaded through a computed specifier so the bundler leaves it as a
 * native import: it lives in the public folder and must keep wasm-bindgen's own
 * `new URL('rubix_wasm_solver_bg.wasm', import.meta.url)` resolution.
 */
export function loadSolver(): Promise<SolverBridge> {
  if (!bridgePromise) {
    bridgePromise = (async () => {
      const moduleUrl: string = MODULE_URL;
      const module = (await import(/* @vite-ignore */ moduleUrl)) as RubixModule;
      await module.default();

      const api: SolverBridge = {
        version: module.solver_version(),
        tableBytes: 0,
        solvedFacelets: module.solved_facelets(),
        solve: (facelets, maxDepth) => module.solve_cube(facelets, maxDepth),
        applyMoves: (facelets, moves) => module.js_apply_moves(facelets, moves),
        isSolved: (facelets) => module.js_is_solved(facelets),
        validationError: (facelets) => module.js_validation_error(facelets) ?? null,
        moveIndices: (moves) => module.js_move_indices(moves),
        moveIndex: (token) => module.move_index(token),
        moveTurn: (moveIndex) => {
          const turn = module.move_turn(moveIndex);
          if (turn.length !== 3) return null;
          return [turn[0], turn[1], turn[2]];
        },
        warmUp: () => {
          module.warm_up();
          api.tableBytes = module.table_bytes();
        },
      };
      bridge = api;
      return api;
    })().catch((error: unknown) => {
      // Let the caller (the state) report the failure; a retry is possible
      // because the cached promise is dropped again.
      bridgePromise = null;
      throw error;
    });
  }
  return bridgePromise;
}

/** Sticker colours of a facelet string; unpainted stickers become `6`. */
export function faceletsToColors(facelets: string): number[] {
  return Array.from(facelets, (letter) => {
    const index = FACE_LETTERS.indexOf(letter as (typeof FACE_LETTERS)[number]);
    return index === -1 ? UNKNOWN_STICKER : index;
  });
}

/** Facelet string of sticker colours; `6` (or anything out of range) becomes `?`. */
export function colorsToFacelets(colors: readonly number[]): string {
  return colors.map((color) => FACE_LETTERS[color] ?? UNKNOWN_LETTER).join('');
}

/** A fresh, solved cube. */
export function solvedColors(): number[] {
  return faceletsToColors(SOLVED_FACELETS);
}
