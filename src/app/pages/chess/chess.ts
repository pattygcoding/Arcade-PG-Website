import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { format, strings } from '../../i18n/i18n';

/**
 * The engine's worker, served from the public folder next to the wasm it loads.
 * The page only ever talks to the worker; it never imports the wasm-bindgen glue
 * itself, so a search can never block the board.
 */
const WORKER_URL = '/wasm/chess-worker.js';

/**
 * The glyphs a piece's body is drawn with, by the piece the engine's placement
 * string uses.
 *
 * Both colours draw the same artwork - the solid `BLACK CHESS ...` code points
 * (U+265A-U+265F) - and take their white or black body from the piece's own
 * `color`.  Their `WHITE CHESS ...` counterparts (U+2654-U+2659) are the same
 * drawings left hollow, so they are no use as a body: the square showed straight
 * through one.  They are the line art instead; see `LINE_GLYPHS`.
 */
const GLYPHS: Readonly<Record<string, string>> = {
  P: '\u265F',
  N: '\u265E',
  B: '\u265D',
  R: '\u265C',
  Q: '\u265B',
  K: '\u265A',
};

/**
 * The line art drawn over a piece's body, as the hollow glyph of the same drawing.
 *
 * The solid glyph is the hollow one with its interior filled in, so it loses the
 * lines that give a piece its shape: a pawn's collar and base, a bishop's mitre.
 * Laying the hollow glyph over the body in the opposite colour puts them back, on
 * a body that stays solid - which is what the stylesheet does with the
 * `data-lines` attribute.
 */
const LINE_GLYPHS: Readonly<Record<string, string>> = {
  P: '\u2659',
  N: '\u2658',
  B: '\u2657',
  R: '\u2656',
  Q: '\u2655',
  K: '\u2654',
};

const FILES = 'abcdefgh';

/** The perft totals the engine's move generator is checked against. */
const PERFT_EXPECTED: Readonly<Record<number, number>> = {
  1: 20,
  2: 400,
  3: 8902,
  4: 197281,
  5: 4865609,
};

/** One square of the board, as the template draws it. */
interface BoardSquare {
  readonly name: string;
  /** The piece letter, or `.` for an empty square. */
  readonly letter: string;
  /** The accessible name: the piece and the square, or just the square. */
  readonly label: string;
  readonly isLight: boolean;
  readonly isLast: boolean;
  readonly isSelected: boolean;
  readonly isTarget: boolean;
  readonly isCapture: boolean;
  /** True on the king of the side to move while that side is in check. */
  readonly isCheck: boolean;
  readonly fileLabel: string;
  readonly rankLabel: string;
}

/** One row of the move-generator check. */
interface PerftRow {
  readonly depth: number;
  readonly expected: number | null;
  readonly counted: string;
  readonly millis: string;
  readonly matched: boolean;
}

/** A snapshot of the game, which is everything the board is drawn from. */
interface ChessState {
  placement: string;
  side: 'white' | 'black';
  legal: string;
  outcome: string;
  matedSide: string;
  inCheck: boolean;
  lastMove: string;
  ply: number;
  moves: string[];
}

/** A search's report, which is what the statistics panel shows. */
interface ChessStats {
  depth: number;
  score: number;
  mateIn: number;
  nodes: number;
  nodesPerSecond: number;
  timeMs: number;
  pv: string;
}

/** A reply from the worker.  Only one field is filled in per command. */
interface WorkerReply {
  id: number;
  ok: boolean;
  error?: string;
  state?: ChessState;
  tt?: number;
  san?: string;
  search?: ChessStats & { uci: string; san: string };
  depth?: number;
  nodes?: number;
  expected?: number | null;
  timeMs?: number;
  type?: string;
  score?: number;
  mateIn?: number;
  nodesPerSecond?: number;
  pv?: string;
}

const INITIAL_STATE: ChessState = {
  placement: 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR',
  side: 'white',
  legal: '',
  outcome: 'playing',
  matedSide: '',
  inCheck: false,
  lastMove: '',
  ply: 0,
  moves: [],
};

@Component({
  selector: 'app-chess',
  imports: [RepoButton],
  templateUrl: './chess.html',
  styleUrl: './chess.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chess implements OnInit, OnDestroy {
  protected readonly t = strings;
  protected readonly repo = 'https://github.com/pattygcoding/PG-Chess';
  protected readonly glyphs = GLYPHS;
  protected readonly lines = LINE_GLYPHS;
  protected readonly files = FILES;
  /** The four pieces a pawn can promote to, in the order the chooser shows them. */
  protected readonly promotionPieces = ['q', 'r', 'b', 'n'] as const;

  private readonly changeDetector = inject(ChangeDetectorRef);

  private worker?: Worker;
  private readonly pending = new Map<
    number,
    { resolve: (reply: WorkerReply) => void; reject: (error: Error) => void }
  >();
  private requestId = 0;
  private thinking = false;

  protected readonly state = signal<ChessState>(INITIAL_STATE);
  protected readonly stats = signal<ChessStats | null>(null);
  protected readonly message = signal(strings.chess.status.loading);
  protected readonly warning = signal(false);
  protected readonly perftRows = signal<readonly PerftRow[]>([]);
  protected readonly perftRunning = signal(false);
  protected readonly level = signal(1);
  protected readonly humanSide = signal<'white' | 'black' | 'none'>('white');
  protected readonly flipped = signal(false);
  protected readonly selected = signal<string | null>(null);
  protected readonly promotion = signal<{ prefix: string; side: 'white' | 'black' } | null>(null);

  /** The squares the selected piece can move to, and whether each is a capture. */
  private readonly targets = computed(() => {
    const selected = this.selected();
    const targets = new Map<string, boolean>();
    if (!selected) {
      return targets;
    }
    for (const uci of this.state().legal.split(' ')) {
      if (uci.startsWith(selected) && uci.length >= 4) {
        targets.set(uci.slice(2, 4), uci.length === 5);
      }
    }
    return targets;
  });

  /** The board, in the current orientation, row by row from the top. */
  protected readonly squares = computed<readonly BoardSquare[]>(() => {
    const state = this.state();
    const flipped = this.flipped();
    const selected = this.selected();
    const targets = this.targets();
    const rows: BoardSquare[] = [];

    for (let row = 0; row < 8; row += 1) {
      // Row 0 is the top of the board: rank 8 unless the board is flipped, and the
      // files always run a-to-h left to right unless it is.
      const rank = flipped ? row : 7 - row;
      for (let column = 0; column < 8; column += 1) {
        const file = flipped ? 7 - column : column;
        const name = `${FILES[file]}${rank + 1}`;
        const letter = letterAt(name, state.placement);
        const isCapture = letter !== '.' && targets.has(name);
        const kingLetter = state.side === 'white' ? 'K' : 'k';
        rows.push({
          name,
          letter,
          label: letter === '.' ? name : `${this.pieceName(letter)} ${name}`,
          isLight: (file + rank) % 2 === 1,
          isLast: state.lastMove.length >= 4 && state.lastMove.includes(name),
          isSelected: selected === name,
          isTarget: targets.has(name) && !isCapture,
          isCapture,
          isCheck: state.inCheck && letter === kingLetter,
          fileLabel: row === 7 ? FILES[file] : '',
          rankLabel: column === 0 ? String(rank + 1) : '',
        });
      }
    }
    return rows;
  });

  /** The move list, as numbered pairs. */
  protected readonly moveRows = computed<readonly { number: string; white: string; black: string }[]>(
    () => {
      const moves = this.state().moves;
      const rows: { number: string; white: string; black: string }[] = [];
      for (let index = 0; index < moves.length; index += 2) {
        rows.push({
          number: `${index / 2 + 1}.`,
          white: moves[index] ?? '',
          black: moves[index + 1] ?? '',
        });
      }
      return rows;
    },
  );

  /** The evaluation bar's width in percent, always drawn from white's point of view. */
  protected readonly evalShare = computed(() => {
    const stats = this.stats();
    if (!stats) {
      return 50;
    }
    if (stats.mateIn !== 0) {
      const whiteIsWinning =
        stats.mateIn > 0 ? this.state().side === 'white' : this.state().side === 'black';
      return whiteIsWinning ? 100 : 0;
    }
    const centipawns = this.state().side === 'white' ? stats.score : -stats.score;
    return Math.round((1 / (1 + Math.exp(-centipawns / 320))) * 100);
  });

  /** The engine's score in words, for the status line. */
  protected readonly evalLabel = computed(() => describeScore(this.stats()));

  ngOnInit(): void {
    this.startWorker();
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }

  /** Starts the worker and asks for the opening position. */
  private startWorker(): void {
    let worker: Worker;
    try {
      // A module worker, because the engine's glue is an ES module.  Some very old
      // browsers refuse that, and a page with no engine should still explain
      // itself rather than throw on load.
      worker = new Worker(WORKER_URL, { type: 'module' });
    } catch (error) {
      this.reportWarning(`${this.t.chess.status.failed}: ${(error as Error).message}`);
      return;
    }
    worker.onmessage = (event: MessageEvent<WorkerReply>) => this.onWorkerMessage(event.data);
    worker.onerror = (event) => {
      this.reportWarning(`${this.t.chess.status.failed}: ${event.message}`);
    };
    this.worker = worker;
    this.send('new', { level: this.level() })
      .then((reply) => this.applyReply(reply))
      .catch((error: Error) => this.reportWarning(error.message));
  }

  /** Sends a command and resolves with the reply that carries the same id. */
  private send(cmd: string, args: Record<string, unknown> = {}): Promise<WorkerReply> {
    const worker = this.worker;
    if (!worker) {
      return Promise.reject(new Error(this.t.chess.status.failed));
    }
    return new Promise<WorkerReply>((resolve, reject) => {
      const id = ++this.requestId;
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, cmd, ...args });
    });
  }

  private onWorkerMessage(message: WorkerReply): void {
    // Progress arrives without an id of its own; everything else is a reply.
    if (message.type === 'progress') {
      this.stats.set({
        depth: message.depth ?? 0,
        score: message.score ?? 0,
        mateIn: message.mateIn ?? 0,
        nodes: message.nodes ?? 0,
        nodesPerSecond: message.nodesPerSecond ?? 0,
        timeMs: message.timeMs ?? 0,
        pv: message.pv ?? '',
      });
      this.changeDetector.markForCheck();
      return;
    }

    const waiter = this.pending.get(message.id);
    if (!waiter) {
      return;
    }
    this.pending.delete(message.id);
    if (message.ok) {
      waiter.resolve(message);
    } else {
      waiter.reject(new Error(message.error ?? this.t.chess.status.failed));
    }
  }

  /** Applies a snapshot, draws it, and moves for the engine when it is its turn. */
  private async applyReply(reply: WorkerReply): Promise<void> {
    if (reply.state) {
      this.state.set(reply.state);
    }
    if (reply.san) {
      // The move list comes from the worker's snapshot, so nothing to do here.
    }
    this.selected.set(null);
    this.promotion.set(null);
    this.changeDetector.markForCheck();

    if (this.state().outcome !== 'playing') {
      this.showMessage(this.outcomeText());
      return;
    }
    if (this.humanSide() === 'none' || !this.isHumanTurn()) {
      await this.engineTurn();
      return;
    }
    this.showMessage(this.state().inCheck ? this.t.chess.in_check : this.t.chess.your_move);
  }

  /** Asks the worker to think, then plays the move it chose. */
  private async engineTurn(): Promise<void> {
    if (this.thinking || this.state().outcome !== 'playing') {
      return;
    }
    const side = this.state().side;
    this.thinking = true;
    let chosen: { uci: string; san: string; depth: number } | null = null;
    this.showMessage(side === 'white' ? this.t.chess.thinking_white : this.t.chess.thinking_black);
    try {
      const reply = await this.send('search', { level: this.level() });
      const search = reply.search;
      if (search?.uci) {
        this.stats.set(search);
        this.showMessage(
          format(this.t.chess.played, {
            side: side === 'white' ? this.t.chess.white : this.t.chess.black,
            move: search.san,
            depth: search.depth,
            score: describeScore(search),
          }),
        );
        chosen = search;
      }
    } catch (error) {
      this.reportWarning((error as Error).message);
    } finally {
      // The guard is released before the move is applied, because applying it is
      // what decides whether the engine has to move again: in a game where it plays
      // both sides, that call comes straight back here.
      this.thinking = false;
    }
    if (chosen) {
      await this.applyReply(await this.send('play', { uci: chosen.uci }));
    }
  }

  /** A click picks a piece up, or plays the move when a target square is clicked. */
  protected onSquare(name: string): void {
    if (this.thinking || this.promotion() || this.state().outcome !== 'playing') {
      return;
    }
    if (!this.isHumanTurn()) {
      return;
    }
    if (this.selected() && this.targets().has(name)) {
      void this.playMove(`${this.selected()}${name}`);
      return;
    }
    const letter = letterAt(name, this.state().placement);
    const isOwn = letter !== '.' && this.colourOf(letter) === this.state().side;
    this.selected.set(isOwn ? name : null);
    this.changeDetector.markForCheck();
  }

  /** Plays a move, asking which piece to promote to when the rules give a choice. */
  protected async playMove(prefix: string): Promise<void> {
    const choices = this.state()
      .legal.split(' ')
      .filter((uci) => uci.startsWith(prefix) && uci.length === 5);
    if (choices.length === 0) {
      await this.play(prefix);
      return;
    }
    this.selected.set(null);
    this.promotion.set({ prefix, side: this.state().side });
    this.changeDetector.markForCheck();
  }

  /** Completes a pending promotion with the piece the visitor picked. */
  protected choosePromotion(piece: string): void {
    const pending = this.promotion();
    this.promotion.set(null);
    if (pending) {
      void this.play(pending.prefix + piece);
    }
  }

  /** Cancels a pending promotion, leaving the position as it was. */
  protected cancelPromotion(): void {
    this.promotion.set(null);
    this.selected.set(null);
    this.changeDetector.markForCheck();
  }

  private async play(uci: string): Promise<void> {
    try {
      await this.applyReply(await this.send('play', { uci }));
    } catch (error) {
      this.reportWarning(`${this.t.chess.status.illegal}: ${(error as Error).message}`);
    }
  }

  /** Starts a fresh game at the chosen level. */
  protected newGame(): void {
    this.stats.set(null);
    this.send('new', { level: this.level() })
      .then((reply) => this.applyReply(reply))
      .catch((error: Error) => this.reportWarning(error.message));
  }

  /** Takes back a full move: the engine's reply and the visitor's move. */
  protected takeBack(): void {
    if (this.thinking) {
      return;
    }
    const plies = this.humanSide() === 'none' ? 1 : 2;
    this.send('undo', { plies })
      .then((reply) => this.applyReply(reply))
      .catch((error: Error) => this.reportWarning(error.message));
  }

  protected flip(): void {
    this.flipped.update((value) => !value);
  }

  protected onLevel(event: Event): void {
    this.level.set(Number((event.target as HTMLSelectElement).value));
  }

  protected onSide(event: Event): void {
    this.humanSide.set((event.target as HTMLSelectElement).value as 'white' | 'black' | 'none');
    this.send('state')
      .then((reply) => this.applyReply(reply))
      .catch((error: Error) => this.reportWarning(error.message));
  }

  /** Counts the first five depths from the starting position, live in this tab. */
  protected runPerft(): void {
    if (this.perftRunning()) {
      return;
    }
    this.perftRunning.set(true);
    this.perftRows.set([]);
    void this.collectPerft();
  }

  private async collectPerft(): Promise<void> {
    const rows: PerftRow[] = [];
    try {
      for (let depth = 1; depth <= Object.keys(PERFT_EXPECTED).length; depth += 1) {
        const reply = await this.send('perft', { depth });
        const expected = reply.expected ?? null;
        const counted = Math.round(reply.nodes ?? 0);
        rows.push({
          depth,
          expected,
          counted: counted.toLocaleString(),
          millis: `${Math.round(reply.timeMs ?? 0)} ms`,
          matched: expected === null || counted === expected,
        });
        this.perftRows.set([...rows]);
        this.changeDetector.markForCheck();
      }
    } catch (error) {
      this.reportWarning((error as Error).message);
    } finally {
      this.perftRunning.set(false);
      this.changeDetector.markForCheck();
    }
  }

  protected isHumanTurn(): boolean {
    return this.humanSide() === this.state().side;
  }

  /** The accessible name of a piece, from the locale bundle. */
  private pieceName(letter: string): string {
    const names = this.t.chess.pieces as Record<string, string>;
    return names[letter] ?? letter;
  }

  /** The principal variation, in SAN, or a line explaining that there is none. */
  protected pvText(): string {
    const pv = this.stats()?.pv;
    return pv ? format(this.t.chess.pv, { line: pv }) : this.t.chess.pv_idle;
  }

  /** Thousands-separated node counts, which is all the engine reports here. */
  protected formatCount(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return String(value);
  }

  private colourOf(letter: string): 'white' | 'black' {
    return letter === letter.toUpperCase() ? 'white' : 'black';
  }

  private outcomeText(): string {
    switch (this.state().outcome) {
      case 'checkmate':
        return format(this.t.chess.result.checkmate, {
          side:
            this.state().matedSide === 'white' ? this.t.chess.white : this.t.chess.black,
        });
      case 'stalemate':
        return this.t.chess.result.stalemate;
      case 'fifty-move':
        return this.t.chess.result.fifty_move;
      case 'repetition':
        return this.t.chess.result.repetition;
      case 'insufficient-material':
        return this.t.chess.result.material;
      default:
        return '';
    }
  }

  private showMessage(text: string): void {
    this.warning.set(false);
    this.message.set(text);
    this.changeDetector.markForCheck();
  }

  private reportWarning(text: string): void {
    this.warning.set(true);
    this.message.set(text);
    this.changeDetector.markForCheck();
  }
}

/** The piece on a named square, from the engine's a8-first placement string. */
function letterAt(name: string, placement: string): string {
  const file = FILES.indexOf(name[0]);
  const rank = Number(name[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    return '.';
  }
  return placement[(7 - rank) * 8 + file] ?? '.';
}

/** A score in words: a mate distance when there is one, otherwise pawns. */
function describeScore(stats: ChessStats | null): string {
  if (!stats) {
    return '—';
  }
  if (stats.mateIn !== 0) {
    return stats.mateIn > 0 ? `#${Math.abs(stats.mateIn)}` : `-#${Math.abs(stats.mateIn)}`;
  }
  const sign = stats.score > 0 ? '+' : '';
  return `${sign}${(stats.score / 100).toFixed(2)}`;
}

