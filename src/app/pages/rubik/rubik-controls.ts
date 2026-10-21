import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { format, strings } from '../../i18n/i18n';
import { colorName, type RubikCubeState } from './rubik-cube-state';
import { FACE_COLORS, UNKNOWN_CSS, UNKNOWN_STICKER } from './rubik-geometry';

/** One entry of the colour palette: a face colour, or the eraser. */
interface Swatch {
  /** Sticker value the entry paints with. */
  readonly value: number;
  /** Colour name, from `en.json`. */
  readonly name: string;
  /** CSS colour of the chip. */
  readonly css: string;
  /** Keyboard shortcut shown in the tooltip. */
  readonly key: string;
}

/**
 * Everything the user drives the app with: the colour palette, the solve
 * button, playback controls and the move timeline.
 */
@Component({
  selector: 'app-rubik-controls',
  templateUrl: './rubik-controls.html',
  styleUrl: './rubik-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Number keys pick a colour, so painting stays quick.  Bound on `document`
    // rather than the panel, because the cube and the net are outside it.
    '(document:keydown)': 'onKeyDown($event)',
  },
})
export class RubikControls {
  /** The shared cube state, owned by the page. */
  readonly cube = input.required<RubikCubeState>();

  protected readonly t = strings.rubik;
  protected readonly unknown = UNKNOWN_STICKER;

  /** Palette entries: the six colours plus an eraser. */
  protected readonly palette: readonly Swatch[] = [
    ...FACE_COLORS.map((color) => ({
      value: color.id as number,
      name: colorName(color.id),
      css: color.css,
      key: String(color.id + 1),
    })),
    {
      value: UNKNOWN_STICKER,
      name: strings.rubik.palette.erase,
      css: UNKNOWN_CSS,
      key: '0',
    },
  ];

  /** Faces with the current palette colour, for the counts row. */
  protected readonly counts = computed(() =>
    FACE_COLORS.map((color, index) => ({
      letter: color.letter,
      name: colorName(index),
      css: color.css,
      count: this.cube().counts().perColor[index],
    })),
  );

  /** How many stickers are still unpainted. */
  protected readonly missing = computed(() => this.cube().counts().unknown);

  /** Colours whose sticker count is not nine. */
  protected readonly wrongCounts = computed(() =>
    this.counts().filter((entry) => entry.count !== 9),
  );

  /** Why the Solve button is (or is not) available. */
  protected readonly solveReason = computed(() => {
    const cube = this.cube();
    if (cube.isBusy()) return this.t.solve.reason_busy;
    return cube.isSolvable() ? this.t.solve.reason_solve : cube.validation().message;
  });

  /** Scramble always works: it resets an unusable cube first. */
  protected readonly scrambleReason = computed(() =>
    this.cube().isSolvable() ? this.t.solve.scramble_title : this.t.solve.scramble_title_reset,
  );

  /**
   * Why the Play button is (or is not) available.
   *
   * Play is offered whenever the painted cube is solvable and not already
   * solved; it solves the cube itself when no solution has been found yet.
   */
  protected readonly playReason = computed(() => {
    const cube = this.cube();
    if (cube.playing()) return this.t.playback.pause;
    if (cube.isBusy()) return this.t.solve.reason_busy;
    if (cube.isPaintedSolved()) return this.t.playback.reason_solved;
    if (!cube.isSolvable()) return cube.validation().message;
    return cube.hasSolution() ? this.t.playback.reason_play : this.t.playback.reason_solve_play;
  });

  /** Label of the transport's main button. */
  protected readonly playLabel = computed(() => {
    const cube = this.cube();
    if (cube.playing()) return this.t.playback.pause;
    return cube.hasSolution() ? this.t.playback.play : this.t.playback.solve_and_play;
  });

  /** `320 ms / move`, with the number substituted into the locale string. */
  protected readonly speedLabel = computed(() =>
    format(this.t.playback.speed_value, { ms: this.cube().speed() }),
  );

  /** Engine version and table size, shown in the footer. */
  protected readonly engineLabel = computed(() => {
    const cube = this.cube();
    if (!cube.solverVersion()) return this.t.meta.no_solver;
    const tables = cube.tableBytes();
    if (!tables) return cube.solverVersion();
    return `${cube.solverVersion()} - ${format(this.t.meta.tables, {
      mb: (tables / 1024 / 1024).toFixed(1),
    })}`;
  });

  /** One sentence about where the cube stands, shown in the footer. */
  protected readonly stateLabel = computed(() => {
    const cube = this.cube();
    if (cube.isPaintedSolved()) return this.t.meta.solved;
    return cube.isSolvable() ? this.t.meta.ready : this.t.meta.attention;
  });

  /** The detail line under the palette counts. */
  protected readonly paletteHint = computed(() => {
    const missing = this.missing();
    if (missing > 0) {
      return format(this.t.palette.hint_incomplete, { painted: 54 - missing });
    }
    const wrong = this.wrongCounts();
    if (wrong.length > 0) {
      return format(this.t.palette.hint_counts, {
        detail: wrong.map((entry) => `${entry.name} has ${entry.count}`).join(' and '),
      });
    }
    return this.t.palette.hint_complete;
  });

  /** Palette entry tooltip, `White (1)`. */
  protected swatchLabel(entry: Swatch): string {
    return format(this.t.palette.swatch, { name: entry.name, key: entry.key });
  }

  /** Count chip tooltip, `White: 9 of 9 stickers`. */
  protected countLabel(entry: { name: string; count: number }): string {
    return format(this.t.palette.count_title, { color: entry.name, count: entry.count });
  }

  /** Tooltip of the "still unpainted" chip. */
  protected unknownLabel(): string {
    return format(this.t.palette.unknown_title, { count: this.missing() });
  }

  /** The three numbers in the solution summary. */
  protected readonly summary = computed(() => ({
    total: format(this.t.playback.moves, { count: this.cube().moves().length }),
    played: format(this.t.playback.played, { count: this.cube().cursor() }),
    left: format(this.t.playback.left, { count: this.cube().remainingMoves() }),
  }));

  /** `longer than the 22 move limit`. */
  protected readonly overLimitLabel = computed(() =>
    format(this.t.playback.over_limit, { depth: this.cube().maxDepth() }),
  );

  private readonly timelineRef = viewChild<ElementRef<HTMLDivElement>>('timeline');

  constructor() {
    // Keep the move that is about to be applied in view.  Only the timeline
    // strip itself may scroll: `scrollIntoView` also scrolls every ancestor,
    // which stole the page scroll away from the reader on every step of
    // playback.
    effect(() => {
      const cursor = this.cube().cursor();
      const total = this.cube().moves().length;
      void cursor;
      void total;
      const timeline = this.timelineRef()?.nativeElement;
      const active = timeline?.querySelector<HTMLElement>('.move.next, .move.current');
      if (!timeline || !active) return;
      // Measure against the strip's own box, so the calculation does not depend
      // on which positioned ancestor the browser picked as the offset parent.
      const left =
        timeline.scrollLeft +
        active.getBoundingClientRect().left -
        timeline.getBoundingClientRect().left -
        (timeline.clientWidth - active.offsetWidth) / 2;
      timeline.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    });
  }

  /** Number keys pick a colour; 0 (or E) picks the eraser. */
  protected onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    const digit = Number.parseInt(event.key, 10);
    if (Number.isFinite(digit) && digit >= 1 && digit <= 6) {
      this.cube().activeColor.set(digit - 1);
    } else if (event.key === '0' || event.key === 'e') {
      this.cube().activeColor.set(UNKNOWN_STICKER);
    }
  }

  /** Timeline entry state: done, current, next or still to come. */
  protected moveClass(index: number): string {
    const cursor = this.cube().cursor();
    if (index === cursor - 1) return 'move current';
    if (index < cursor) return 'move done';
    if (index === cursor) return 'move next';
    return 'move';
  }

  protected jumpLabel(index: number): string {
    return format(this.t.playback.jump, { n: index + 1 });
  }

  protected setMaxDepth(event: Event): void {
    this.cube().setMaxDepth(Number((event.target as HTMLInputElement).value));
  }

  protected setSpeed(event: Event): void {
    this.cube().setSpeed(Number((event.target as HTMLInputElement).value));
  }
}
