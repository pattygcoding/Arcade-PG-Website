import { TestBed } from '@angular/core/testing';
import { Chess } from './chess';

/**
 * A stand-in for the engine worker.
 *
 * The page starts a real module worker in `ngOnInit`, which the test runner has no
 * way to load; this answers the four commands the page sends on its own with the
 * opening position, so the rendering and the message plumbing can be checked
 * without a wasm module present.
 */
const START_PLACEMENT = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  private readonly state = {
    placement: START_PLACEMENT,
    side: 'white',
    legal: 'b1a3 b1c3 g1f3 g1h3 a2a3 a2a4 b2b3 b2b4 c2c3 c2c4 d2d3 d2d4 e2e3 e2e4 f2f3 f2f4 g2g3 g2g4 h2h3 h2h4',
    outcome: 'playing',
    matedSide: '',
    inCheck: false,
    lastMove: '',
    ply: 0,
    moves: [] as string[],
  };

  postMessage(message: { id: number; cmd: string; uci?: string }): void {
    const reply = this.reply(message);
    globalThis.setTimeout(() => this.onmessage?.({ data: reply } as MessageEvent), 0);
  }

  terminate(): void {
    // Nothing to release.
  }

  private reply(message: { id: number; cmd: string; uci?: string }) {
    switch (message.cmd) {
      case 'play': {
        this.state.ply += 1;
        this.state.moves = [...this.state.moves, 'e4'];
        this.state.lastMove = 'e2e4';
        return { id: message.id, ok: true, san: 'e4', state: { ...this.state, moves: [...this.state.moves] } };
      }
      case 'undo': {
        this.state.ply = 0;
        this.state.moves = [];
        return { id: message.id, ok: true, state: { ...this.state, moves: [] } };
      }
      case 'search':
        return {
          id: message.id,
          ok: true,
          search: {
            uci: 'e2e4',
            san: 'e4',
            score: 24,
            mateIn: 0,
            depth: 7,
            nodes: 120000,
            timeMs: 90,
            nodesPerSecond: 1300000,
            pv: 'e4 e5',
          },
        };
      case 'perft':
        return { id: message.id, ok: true, depth: 1, nodes: 20, expected: 20, timeMs: 0 };
      default:
        return { id: message.id, ok: true, state: { ...this.state, moves: [...this.state.moves] }, tt: 33554432 };
    }
  }
}

describe('Chess', () => {
  const originalWorker = (globalThis as { Worker?: unknown }).Worker;

  beforeEach(async () => {
    (globalThis as { Worker?: unknown }).Worker = FakeWorker;
    await TestBed.configureTestingModule({ imports: [Chess] }).compileComponents();
  });

  afterEach(() => {
    (globalThis as { Worker?: unknown }).Worker = originalWorker;
  });

  /** Lets the worker's reply, which is posted on a timeout, arrive. */
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

  it('should draw a full board from the opening position', async () => {
    const fixture = TestBed.createComponent(Chess);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.chess-square')).toHaveLength(64);
    // Sixteen pieces each, drawn as glyphs rather than images.
    expect(compiled.querySelectorAll('.chess-piece')).toHaveLength(32);
    expect(compiled.querySelectorAll('.chess-piece.is-white')).toHaveLength(16);
    expect(compiled.querySelector('.chess-square[data-square="e1"] .chess-piece')?.textContent).toBe(
      '\u2654',
    );
  });

  it('should offer the controls, the engine panel and the perft table', async () => {
    const fixture = TestBed.createComponent(Chess);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toBe('Chess Engine');
    expect(compiled.querySelector('.eyebrow-tech')?.textContent).toContain('RUST / WASM');
    expect(compiled.querySelectorAll('.chess-controls button')).toHaveLength(4);
    expect(compiled.querySelectorAll('.chess-controls select')).toHaveLength(2);
    expect(compiled.querySelectorAll('.chess-perft')).toHaveLength(1);
    expect(compiled.querySelector('[role="status"]')?.textContent?.trim()).toBeTruthy();
    // The page links to the engine's own repository.
    expect(compiled.querySelector('a[href="https://github.com/pattygcoding/PG-Chess"]')).not.toBeNull();
  });

  it('should mark the legal destinations of the piece that was picked up', async () => {
    const fixture = TestBed.createComponent(Chess);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.chess-square[data-square="e2"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.chess-square[data-square="e2"]')?.classList).toContain(
      'is-selected',
    );
    // e3 and e4 are the pawn's two moves, and no other square is marked.
    expect(compiled.querySelectorAll('.chess-target')).toHaveLength(2);
    expect(compiled.querySelector('.chess-square[data-square="e4"] .chess-target')).not.toBeNull();
  });
});
