/**
 * The reactive cube state of the page.
 *
 * One `RubixCubeState` instance owns everything the UI needs: the 54 painted
 * sticker colours, the solver's answer, the playback cursor and the transition
 * the 3D view should animate.  It is written with Angular signals, so every
 * component that reads a value re-renders when it changes.
 *
 * The cube the user paints (`colors`) is the *base* state.  Playing a solution
 * never touches it: the displayed cube is always
 * `applyMoves(base, moves.slice(0, cursor))`, computed by the Rust engine.
 */

import { computed, signal } from '@angular/core';
import { format, strings } from '../../i18n/i18n';
import { FACE_COLORS, UNKNOWN_STICKER } from './rubix-geometry';
import {
  colorsToFacelets,
  describeError,
  faceletsToColors,
  getSolver,
  loadSolver,
  solvedColors,
} from './rubix-solver';

/** Lifecycle of the WebAssembly engine. */
export type SolverStatus = 'loading' | 'building' | 'ready' | 'solving' | 'error';

/**
 * Why the painted cube cannot be solved.
 *
 * `incomplete` and `counts` are worked out from the stickers alone, so they are
 * known before the engine has loaded; `impossible` means the stickers are all
 * there but the cube could not exist, which only the engine can decide.
 */
export type ValidationState = 'incomplete' | 'counts' | 'impossible' | 'ok';

/** The verdict on the painted cube, plus an explanation for the user. */
export interface Validation {
  readonly state: ValidationState;
  /** `true` when the cube can be solved. */
  readonly ok: boolean;
  /** Ready to show message. */
  readonly message: string;
}

/** The kinds of change the 3D view knows how to animate. */
export type TransitionKind = 'none' | 'move' | 'undo' | 'snap';

/**
 * Description of the change that just happened.
 *
 * Views watch `id`, so they can animate a single move, play one backwards or
 * jump straight to a state.
 */
export interface CubeTransition {
  readonly id: number;
  readonly kind: TransitionKind;
  /** The move that was applied (for `move`) or reverted (for `undo`). */
  readonly move: string | null;
}

/** Facelet indices of the six centre stickers, which never move. */
export const CENTRE_STICKERS: readonly number[] = FACE_COLORS.map((_, face) => face * 9 + 4);

const isCentre = (index: number) => CENTRE_STICKERS.includes(index);

/** Number of random moves a scramble uses. */
const SCRAMBLE_LENGTH = 22;

/** Display name of a sticker colour, from `en.json`, for tooltips and messages. */
export function colorName(sticker: number | undefined): string {
  const letter = sticker === undefined ? undefined : FACE_COLORS[sticker]?.letter;
  return letter
    ? strings.rubix.colors[letter as keyof typeof strings.rubix.colors]
    : strings.rubix.colors.unknown;
}

export class RubixCubeState {
  // -- the cube the user paints ------------------------------------------
  /** Sticker colours: 54 entries of `0..5` or `UNKNOWN_STICKER`. */
  readonly colors = signal<number[]>(solvedColors());
  /** Colour the palette has selected. */
  readonly activeColor = signal<number>(0);

  // -- solver -------------------------------------------------------------
  /** Solution moves in Singmaster notation. */
  readonly moves = signal<string[]>([]);
  /** How many of `moves` are currently applied to the displayed cube. */
  readonly cursor = signal(0);
  /** Longest solution the user accepts, passed to the engine. */
  readonly maxDepth = signal(22);
  /** Lifecycle of the WebAssembly engine. */
  readonly status = signal<SolverStatus>('loading');
  /** Informational note for the user (solution length, scramble, ...). */
  readonly message = signal('');
  /** Error reported by the engine, e.g. an impossible cube. */
  readonly error = signal('');
  /** Version string reported by the engine. */
  readonly solverVersion = signal('');
  /** Bytes of lookup tables the engine allocated. */
  readonly tableBytes = signal(0);
  /** Milliseconds spent building the lookup tables. */
  readonly buildTimeMs = signal(0);

  // -- playback -----------------------------------------------------------
  /** Is the solution playing? */
  readonly playing = signal(false);
  /** Milliseconds per move, between 100 and 800. */
  readonly speed = signal(320);
  /** The change the 3D view should animate. */
  readonly transition = signal<CubeTransition>({ id: 0, kind: 'none', move: null });
  /** Bumped when the engine becomes usable, so derived values recompute. */
  readonly solverGeneration = signal(0);

  /** Timer of the playback loop. */
  private timer: ReturnType<typeof setTimeout> | null = null;

  // -- derived state ------------------------------------------------------

  /** Facelet string of the cube being painted. */
  readonly facelets = computed(() => colorsToFacelets(this.colors()));

  /** Moves that are currently applied to the displayed cube. */
  readonly displayedMoves = computed(() => this.moves().slice(0, this.cursor()));

  /**
   * Facelet string of the cube as it is shown right now.
   *
   * While nothing is playing this is simply the painted cube, so the 3D view
   * and the net agree even before the engine has loaded.  A throw is swallowed
   * here, because a computed may not write to a signal: the actions that hand
   * moves to the engine report engine failures themselves.
   */
  readonly displayFacelets = computed(() => {
    const base = this.facelets();
    // Reading the generation makes this recompute once the engine is ready.
    void this.solverGeneration();
    if (this.cursor() === 0 || this.moves().length === 0) return base;
    const solver = getSolver();
    if (!solver) return base;
    try {
      return solver.applyMoves(base, this.displayedMoves().join(' '));
    } catch (error) {
      console.error('Failed to apply moves:', error);
      return base;
    }
  });

  /** Sticker colours of the displayed cube. */
  readonly displayColors = computed(() => faceletsToColors(this.displayFacelets()));

  /** How often each colour appears, plus the number of unpainted stickers. */
  readonly counts = computed(() => {
    const perColor = FACE_COLORS.map(() => 0);
    let unknown = 0;
    for (const color of this.colors()) {
      if (color >= 0 && color < perColor.length) perColor[color] += 1;
      else unknown += 1;
    }
    return { perColor, unknown };
  });

  /** True when all 54 stickers are painted and every colour appears 9 times. */
  readonly isComplete = computed(
    () => this.counts().unknown === 0 && this.counts().perColor.every((count) => count === 9),
  );

  /**
   * The verdict on the painted cube.
   *
   * Sticker level problems are found here; whether the stickers describe a cube
   * that could physically exist is decided by the engine's validator, which is
   * the same code `solve_cube` runs, so the two can never disagree.
   */
  readonly validation = computed<Validation>(() => {
    // Reading the generation makes this recompute once the engine is ready.
    void this.solverGeneration();
    const { unknown, perColor } = this.counts();

    if (unknown > 0) {
      return {
        state: 'incomplete',
        ok: false,
        message:
          unknown === 54
            ? strings.rubix.message.blank_cube
            : format(strings.rubix.message.incomplete, { painted: 54 - unknown, unknown }),
      };
    }

    const wrong = FACE_COLORS.map((color, index) => ({
      name: colorName(index),
      count: perColor[index],
    })).filter((entry) => entry.count !== 9);
    if (wrong.length > 0) {
      const detail = wrong
        .map((entry) =>
          format(
            entry.count > 9
              ? strings.rubix.message.too_many
              : strings.rubix.message.too_few,
            { color: entry.name, count: entry.count },
          ),
        )
        .join(', ');
      return {
        state: 'counts',
        ok: false,
        message: format(strings.rubix.message.counts, { detail }),
      };
    }

    const solver = getSolver();
    if (!solver) {
      return { state: 'incomplete', ok: false, message: strings.rubix.message.waiting };
    }
    try {
      const problem = solver.validationError(this.facelets());
      if (problem) return { state: 'impossible', ok: false, message: problem };
    } catch (error) {
      return { state: 'impossible', ok: false, message: describeError(error) };
    }
    return { state: 'ok', ok: true, message: strings.rubix.message.solvable };
  });

  /** True when the engine accepts the painted cube. */
  readonly isSolvable = computed(() => this.validation().ok);

  /** The single sentence to show the user about the cube. */
  readonly validationMessage = computed(() => this.validation().message);

  /** True when the displayed cube is solved. */
  readonly isSolved = computed(() => isFaceletsSolved(this.displayFacelets()));

  /**
   * True when the *painted* cube is already solved.
   *
   * The transport controls are about the cube the user painted, not about how
   * far a solution has been played, so a finished solution does not stop Play
   * from replaying it.
   */
  readonly isPaintedSolved = computed(() => {
    const facelets = this.facelets();
    return !facelets.includes('?') && isFaceletsSolved(facelets);
  });

  /** The move that was applied last, if any. */
  readonly currentMove = computed(() => (this.cursor() > 0 ? this.moves()[this.cursor() - 1] : null));
  /** The move that is about to be applied, if any. */
  readonly upcomingMove = computed(() => this.moves()[this.cursor()] ?? null);
  /** How many moves are left to play. */
  readonly remainingMoves = computed(() => Math.max(0, this.moves().length - this.cursor()));
  /** Fraction of the solution that has been played, `0..1`. */
  readonly progress = computed(() =>
    this.moves().length === 0 ? 0 : this.cursor() / this.moves().length,
  );
  /** True when the answer is longer than the requested maximum. */
  readonly exceedsLimit = computed(
    () => this.moves().length > 0 && this.moves().length > this.maxDepth(),
  );
  /** True when a solution exists and can be played. */
  readonly hasSolution = computed(() => this.moves().length > 0);
  /** True while the engine is loading or solving. */
  readonly isBusy = computed(
    () =>
      this.status() === 'loading' || this.status() === 'building' || this.status() === 'solving',
  );

  /**
   * True when the Play button should be available.
   *
   * Play is the primary action: it is offered as soon as the painted cube is
   * solvable and not already solved, and it solves the cube itself when there
   * is no solution yet.  Anything else - an unpainted, miscounted or impossible
   * cube, an already solved one, or a busy engine - turns it off.
   */
  readonly canPlay = computed(() => !this.isBusy() && this.isSolvable() && !this.isPaintedSolved());

  // -- lifecycle ----------------------------------------------------------

  /**
   * Load the WebAssembly engine and build its lookup tables.
   *
   * Call this once from the browser: the tables take a moment to build, which
   * is why it happens while the user is still painting stickers.
   */
  async init(): Promise<void> {
    if (this.status() !== 'loading') return;
    try {
      const solver = await loadSolver();
      this.solverVersion.set(solver.version);
      this.status.set('building');
      // Yield once so the UI can show the "preparing" state.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const started = performance.now();
      solver.warmUp();
      this.buildTimeMs.set(Math.round(performance.now() - started));
      this.tableBytes.set(solver.tableBytes);
      this.solverGeneration.update((value) => value + 1);
      this.status.set('ready');
      this.message.set(
        format(strings.rubix.message.engine_ready, {
          mb: (solver.tableBytes / 1024 / 1024).toFixed(1),
          ms: this.buildTimeMs(),
        }),
      );
    } catch (error) {
      this.status.set('error');
      this.error.set(format(strings.rubix.message.engine_failed, { error: describeError(error) }));
    }
  }

  // -- painting -----------------------------------------------------------

  /**
   * Paint one sticker of the *displayed* cube.
   *
   * The index is mapped back to the painted cube, so clicking a sticker while
   * a solution is displayed still edits the right sticker.  Centre stickers are
   * ignored: they never move, so their colour identifies the face.
   */
  paintSticker(displayIndex: number, color: number): void {
    const index = this.baseStickerIndex(displayIndex);
    if (isCentre(index)) {
      this.message.set(strings.rubix.message.centre_fixed);
      return;
    }
    const next = [...this.colors()];
    next[index] = color;
    this.colors.set(next);
    this.clearSolution(strings.rubix.message.edit_cleared);
  }

  /** Remove the colour of one sticker. */
  eraseSticker(displayIndex: number): void {
    this.paintSticker(displayIndex, UNKNOWN_STICKER);
  }

  /** Put the solved cube back. */
  resetToSolved(): void {
    this.colors.set(solvedColors());
    this.clearSolution();
    this.message.set(strings.rubix.message.reset);
    this.error.set('');
  }

  /** Clear every sticker except the centres, ready for a fresh paint. */
  clearPaint(): void {
    this.colors.set(
      this.colors().map((color, index) => (isCentre(index) ? color : UNKNOWN_STICKER)),
    );
    this.clearSolution();
    this.message.set(strings.rubix.message.cleared);
    this.error.set('');
  }

  /**
   * Apply a random move sequence to the cube.
   *
   * Random moves keep whatever is already there, so an unsolvable cube would
   * stay unsolvable forever.  When the painted cube is incomplete or impossible
   * it is reset to a solved cube first, which is what makes Scramble a way out
   * of a mistake as well as a way to get a random puzzle.
   */
  scramble(length = SCRAMBLE_LENGTH): void {
    const solver = getSolver();
    if (!solver) {
      this.error.set(strings.rubix.message.engine_loading);
      return;
    }
    const reset = !this.isSolvable();
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    const suffixes = ['', '2', "'"];
    const parts: string[] = [];
    let previous = -1;
    for (let i = 0; i < length; i++) {
      let face = Math.floor(Math.random() * faces.length);
      while (face === previous) face = Math.floor(Math.random() * faces.length);
      previous = face;
      parts.push(faces[face] + suffixes[Math.floor(Math.random() * suffixes.length)]);
    }
    try {
      const from = reset ? solvedColors() : this.colors();
      this.colors.set(faceletsToColors(solver.applyMoves(colorsToFacelets(from), parts.join(' '))));
      this.clearSolution();
      this.error.set('');
      this.message.set(format(reset ? strings.rubix.message.scramble_reset : strings.rubix.message.scrambled, { count: length }));
    } catch (error) {
      this.error.set(describeError(error));
    }
  }

  /**
   * Map a sticker of the displayed cube back to the painted cube.
   *
   * Uses the engine's composed move permutation, so it stays correct for any
   * number of applied moves.
   */
  baseStickerIndex(displayIndex: number): number {
    if (this.cursor() === 0 || this.moves().length === 0) return displayIndex;
    const solver = getSolver();
    if (!solver) return displayIndex;
    try {
      const permutation = solver.moveIndices(this.displayedMoves().join(' '));
      return permutation[displayIndex] ?? displayIndex;
    } catch (error) {
      this.error.set(describeError(error));
      return displayIndex;
    }
  }

  // -- solving ------------------------------------------------------------

  /** Ask the engine to solve the painted cube. */
  async solve(): Promise<void> {
    const solver = getSolver();
    if (!solver) {
      this.error.set(strings.rubix.message.engine_loading);
      return;
    }
    this.pause();
    this.error.set('');
    this.message.set('');
    this.status.set('solving');
    // Yield once so the UI can show that the engine is working.
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const answer = solver.solve(this.facelets(), this.maxDepth()).trim();
      const moves = answer.length === 0 ? [] : answer.split(/\s+/);
      this.moves.set(moves);
      this.cursor.set(0);
      this.bump('snap');
      if (moves.length === 0) {
        this.message.set(strings.rubix.message.already_solved);
      } else if (moves.length > this.maxDepth()) {
        this.message.set(
          format(strings.rubix.message.over_limit, { count: moves.length, depth: this.maxDepth() }),
        );
      } else {
        this.message.set(format(strings.rubix.message.solved, { count: moves.length }));
      }
    } catch (error) {
      this.moves.set([]);
      this.cursor.set(0);
      this.error.set(describeError(error));
    } finally {
      this.status.set('ready');
    }
  }

  // -- playback -----------------------------------------------------------

  /**
   * Start, or resume, playing the solution.
   *
   * Play works as soon as the painted cube is solvable and unsolved: when there
   * is no solution yet the cube is solved first, so the button is never a dead
   * end.  A solution that has already been played to the end simply starts again.
   */
  async play(): Promise<void> {
    if (this.isBusy()) return;
    if (this.moves().length === 0) {
      if (!this.canPlay()) return;
      await this.solve();
      if (this.moves().length === 0) return;
    }
    if (this.cursor() >= this.moves().length) {
      this.cursor.set(0);
      this.bump('snap');
    }
    this.playing.set(true);
    this.scheduleStep();
  }

  /** Stop playing, keeping the current position. */
  pause(): void {
    this.playing.set(false);
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Play or pause, depending on the current state. */
  togglePlay(): void {
    if (this.playing()) this.pause();
    else void this.play();
  }

  /** Apply the next move, animating it. Returns false at the end. */
  stepForward(): boolean {
    if (this.cursor() >= this.moves().length) return false;
    const move = this.moves()[this.cursor()];
    this.cursor.update((value) => value + 1);
    this.bump('move', move);
    return true;
  }

  /** Undo the last move, animating it backwards. Returns false at the start. */
  stepBackward(): boolean {
    if (this.cursor() <= 0) return false;
    const move = this.moves()[this.cursor() - 1];
    this.cursor.update((value) => value - 1);
    this.bump('undo', move);
    return true;
  }

  /**
   * Move the cursor to any position.
   *
   * A single step is animated; anything else makes the cube jump to the state
   * for that position.
   */
  jumpTo(cursor: number): void {
    const target = Math.max(0, Math.min(this.moves().length, Math.round(cursor)));
    if (target === this.cursor()) return;
    this.pause();
    if (target === this.cursor() + 1) {
      this.stepForward();
      return;
    }
    if (target === this.cursor() - 1) {
      this.stepBackward();
      return;
    }
    this.cursor.set(target);
    this.bump('snap');
  }

  /** Set the playback speed, in milliseconds per move. */
  setSpeed(milliseconds: number): void {
    this.speed.set(Math.max(100, Math.min(800, Math.round(milliseconds))));
  }

  /** Set the longest solution the engine may return. */
  setMaxDepth(depth: number): void {
    this.maxDepth.set(Math.max(15, Math.min(30, Math.round(depth))));
  }

  // -- internals ----------------------------------------------------------

  private scheduleStep(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.playing()) return;
      const advanced = this.stepForward();
      if (advanced && this.cursor() < this.moves().length) {
        this.scheduleStep();
      } else {
        this.playing.set(false);
        if (advanced) this.message.set(strings.rubix.message.finished);
      }
    }, this.speed());
  }

  /** Drop the solution, snapping the cube back to the painted state. */
  private clearSolution(message?: string): void {
    const hadSolution = this.moves().length > 0 || this.cursor() > 0;
    this.pause();
    this.moves.set([]);
    this.cursor.set(0);
    if (hadSolution) {
      this.bump('snap');
      if (message) this.message.set(message);
    }
  }

  /** Announce a change for the 3D view to animate. */
  private bump(kind: TransitionKind, move: string | null = null): void {
    this.transition.update((value) => ({ id: value.id + 1, kind, move }));
  }
}

/** True when every face of a facelet string is one colour. */
function isFaceletsSolved(facelets: string): boolean {
  for (let face = 0; face < 6; face++) {
    const first = facelets[face * 9];
    for (let k = 1; k < 9; k++) {
      if (facelets[face * 9 + k] !== first) return false;
    }
  }
  return true;
}
