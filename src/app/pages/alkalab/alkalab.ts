import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';

const WIDTH = 320;
const HEIGHT = 200;
/** wasm-bindgen glue served from the public folder, next to alkalab.wasm. */
const MODULE_URL = '/wasm/alkalab.js';

/** Keyboard quick-pick palette (1-9 and 0), matching the original front end. */
const HOTKEYS = ['Sand', 'Water', 'Stone', 'Wood', 'Fire', 'Oil', 'Sodium', 'Lava', 'Acid', 'TNT'];

const STATUS_LABELS: Record<Status, string> = {
  loading: strings.alkalab.status.loading,
  ready: strings.alkalab.status.ready,
  runtime_failed: strings.alkalab.status.runtime_failed,
};

type Status = 'loading' | 'ready' | 'runtime_failed';
type Shape = 'circle' | 'square' | 'spray';
type Tool = 'paint' | 'boom';

interface ElementEntry {
  id: number;
  name: string;
  formula: string;
  color: string;
  desc: string;
}

interface ReactionEntry {
  equation: string;
  count: number;
}

interface LabStats {
  fps: number;
  frame: number;
  particles: number;
  canUndo: boolean;
}

interface AlkalabWasm {
  memory: WebAssembly.Memory;
}

/** The exported engine handle, as described by alkalab.js. */
interface AlkalabEngine {
  readonly width: number;
  readonly height: number;
  readonly pixel_ptr: number;
  readonly pixel_len: number;
  readonly frame: number;
  readonly particle_count: number;
  readonly can_undo: boolean;
  element_catalog(): string;
  reactions(): string;
  step(): void;
  step_n(count: number): void;
  clear(): void;
  undo(): void;
  snapshot(): void;
  paint(x: number, y: number, radius: number, elementId: number): void;
  paint_rect(x0: number, y0: number, x1: number, y1: number, elementId: number): void;
  paint_line(x0: number, y0: number, x1: number, y1: number, radius: number, elementId: number): void;
  detonate(x: number, y: number, radius: number): void;
  free(): void;
}

/** Shape of the wasm-bindgen module (`/wasm/alkalab.js`). */
interface AlkalabModule {
  default(): Promise<AlkalabWasm>;
  Engine: new (width: number, height: number, seed: number) => AlkalabEngine;
}

interface Preset {
  key: string;
  label: string;
  build(engine: AlkalabEngine, idOf: (name: string) => number): void;
}

// Demo scenes.  Each takes the engine and an element-id lookup so the palette
// generated from the Rust property table stays the single source of truth.
const PRESETS: readonly Preset[] = [
  {
    key: 'sodium_water',
    label: strings.alkalab.presets.sodium_water,
    build(engine, idOf) {
      engine.paint_rect(20, 150, 300, 196, idOf('Water'));
      engine.paint(60, 120, 3, idOf('Sodium'));
      engine.paint(160, 118, 3, idOf('Sodium'));
      engine.paint(260, 120, 3, idOf('Sodium'));
      engine.paint(110, 130, 2, idOf('Potassium'));
      engine.paint(210, 130, 2, idOf('Lithium'));
    },
  },
  {
    key: 'volcano',
    label: strings.alkalab.presets.volcano,
    build(engine, idOf) {
      engine.paint_rect(0, 188, WIDTH - 1, HEIGHT - 1, idOf('Stone'));
      engine.paint_line(30, 188, 160, 118, 7, idOf('Stone'));
      engine.paint_line(290, 188, 160, 118, 7, idOf('Stone'));
      engine.paint_rect(120, 150, 200, 188, idOf('Lava'));
      engine.paint_rect(0, 40, WIDTH - 1, 46, idOf('Water'));
      engine.paint_rect(120, 60, 200, 72, idOf('Water'));
    },
  },
  {
    key: 'density_column',
    label: strings.alkalab.presets.density_column,
    build(engine, idOf) {
      engine.paint_rect(20, 180, 300, 197, idOf('Stone'));
      engine.paint_rect(40, 58, 280, 96, idOf('Oil'));
      engine.paint_rect(40, 24, 280, 56, idOf('Water'));
      engine.paint_rect(40, 2, 280, 22, idOf('Sand'));
      engine.paint(50, 110, 2, idOf('Mercury'));
      engine.paint(270, 110, 2, idOf('Mercury'));
    },
  },
  {
    key: 'vine',
    label: strings.alkalab.presets.vine,
    build(engine, idOf) {
      engine.paint_rect(0, 186, WIDTH - 1, HEIGHT - 1, idOf('Sand'));
      engine.paint_rect(0, 178, WIDTH - 1, 186, idOf('Water'));
      for (let x = 24; x < WIDTH - 10; x += 36) {
        engine.paint(x, 176, 1, idOf('Plant'));
      }
    },
  },
  {
    key: 'demolition',
    label: strings.alkalab.presets.demolition,
    build(engine, idOf) {
      engine.paint_rect(80, 186, 240, 196, idOf('Stone'));
      engine.paint_rect(90, 120, 230, 186, idOf('Wood'));
      engine.paint_rect(120, 140, 200, 170, idOf('TNT'));
      engine.paint_rect(130, 150, 190, 160, idOf('Gunpowder'));
      engine.paint_rect(140, 96, 180, 112, idOf('Hydrogen'));
      engine.paint(160, 92, 2, idOf('Fire'));
    },
  },
  {
    key: 'carbide_cannon',
    label: strings.alkalab.presets.carbide_cannon,
    build(engine, idOf) {
      engine.paint_rect(0, 190, WIDTH - 1, HEIGHT - 1, idOf('Stone'));
      engine.paint_rect(60, 140, 260, 190, idOf('Water'));
      engine.paint_rect(120, 120, 200, 138, idOf('Carbide'));
      engine.paint_rect(0, 30, WIDTH - 1, 34, idOf('Stone'));
    },
  },
];

@Component({
  selector: 'app-alkalab',
  imports: [RepoButton],
  templateUrl: './alkalab.html',
  styleUrl: './alkalab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alkalab implements AfterViewInit, OnDestroy {
  protected readonly t = strings;
  protected readonly notes = strings.alkalab.notes;
  protected readonly presets = PRESETS;
  protected readonly speedOptions = [1, 2, 3, 4];
  protected readonly ariaLabel = strings.alkalab.aria_label;

  protected readonly status = signal<Status>('loading');
  protected readonly catalog = signal<ElementEntry[]>([]);
  protected readonly selected = signal<ElementEntry | null>(null);
  protected readonly brush = signal(4);
  protected readonly shape = signal<Shape>('circle');
  protected readonly tool = signal<Tool>('paint');
  protected readonly running = signal(true);
  protected readonly speed = signal(1);
  protected readonly stats = signal<LabStats>({ fps: 0, frame: 0, particles: 0, canUndo: false });
  protected readonly log = signal<ReactionEntry[]>([]);

  protected readonly palette = computed(() =>
    this.catalog().filter((entry) => entry.name !== 'Air'),
  );
  protected readonly selectedLabel = computed(() => {
    const entry = this.selected();
    return entry ? `${entry.name} - ${entry.formula}` : '';
  });
  protected readonly statusLabel = computed(() => STATUS_LABELS[this.status()]);

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private canvas?: HTMLCanvasElement;
  private wasm?: AlkalabWasm;
  private engine?: AlkalabEngine;
  private byName = new Map<string, ElementEntry>();
  private buffer: ArrayBuffer | null = null;
  private imageData: ImageData | null = null;
  private rafId = 0;
  private logJson: string | null = null;
  private destroyed = false;
  // Input state for the animation loop.
  private painting = false;
  private erasing = false;
  private lastCell: { x: number; y: number } | null = null;

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef().nativeElement;
    void this.boot();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas?.removeEventListener('wheel', this.onWheel);
    try {
      this.engine?.free();
    } catch (error) {
      console.error(error);
    }
    this.engine = undefined;
  }

  // ------------------------------------------------------------------ boot
  //
  // The glue is loaded through a computed specifier so the bundler leaves it as
  // a native import: it lives in the public folder and must keep wasm-bindgen's
  // own `new URL('alkalab.wasm', import.meta.url)` resolution.
  private async boot(): Promise<void> {
    try {
      const moduleUrl: string = MODULE_URL;
      const module = (await import(/* @vite-ignore */ moduleUrl)) as AlkalabModule;
      const wasm = await module.default();
      if (this.destroyed) {
        return;
      }
      this.wasm = wasm;

      const engine = new module.Engine(WIDTH, HEIGHT, (Math.random() * 0xffffffff) >>> 0);
      this.engine = engine;

      const entries = JSON.parse(engine.element_catalog()) as ElementEntry[];
      this.byName = new Map(entries.map((entry) => [entry.name, entry]));
      this.catalog.set(entries);
      this.selected.set(this.byName.get('Sand') ?? entries[0] ?? null);
      this.status.set('ready');

      this.canvas?.addEventListener('wheel', this.onWheel, { passive: false });
      window.addEventListener('keydown', this.onKeyDown);
      this.startLoop();
    } catch (error) {
      console.error('Failed to start Alkalab:', error);
      if (!this.destroyed) {
        this.status.set('runtime_failed');
      }
    }
  }

  // ------------------------------------------------ simulation + render loop
  private startLoop(): void {
    const canvas = this.canvas;
    const engine = this.engine;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !engine || !ctx) {
      return;
    }

    let fps = 0;
    let last = performance.now();
    let countdown = 0;

    const frame = (now: number): void => {
      const dt = now - last;
      last = now;
      if (dt > 0) {
        fps = fps === 0 ? 1000 / dt : fps * 0.9 + (1000 / dt) * 0.1;
      }
      if (this.running()) {
        engine.step_n(this.speed());
      }
      const imageData = this.syncBuffer();
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
      const json = engine.reactions();
      if (json !== this.logJson) {
        this.logJson = json;
        this.log.set(JSON.parse(json) as ReactionEntry[]);
      }
      countdown -= 1;
      if (countdown <= 0) {
        countdown = 10;
        this.stats.set({
          fps,
          frame: engine.frame,
          particles: engine.particle_count,
          canUndo: engine.can_undo,
        });
      }
      this.rafId = requestAnimationFrame(frame);
    };

    this.rafId = requestAnimationFrame(frame);
  }

  // The wasm heap can grow, and growing detaches the old ArrayBuffer, so the
  // Uint8ClampedArray view has to be rebuilt whenever the buffer identity
  // changes.  The view *is* wasm linear memory: no per-frame copies.
  private syncBuffer(): ImageData | null {
    const wasm = this.wasm;
    const engine = this.engine;
    if (!wasm || !engine) {
      return null;
    }
    if (wasm.memory.buffer !== this.buffer) {
      this.buffer = wasm.memory.buffer;
      const pixels = new Uint8ClampedArray(this.buffer, engine.pixel_ptr, engine.pixel_len);
      this.imageData = new ImageData(pixels, engine.width, engine.height);
    }
    return this.imageData;
  }

  // Brush size on the mouse wheel.  Attached natively so preventDefault works.
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.brush.update((value) => Math.max(0, Math.min(24, value + (event.deltaY < 0 ? 1 : -1))));
  };

  // --------------------------------------------------------------- painting
  protected handlePointerDown(event: PointerEvent): void {
    const canvas = this.canvas;
    const engine = this.engine;
    if (!canvas || !engine) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    this.painting = true;
    this.erasing = event.button === 2 || (event.buttons & 2) === 2;
    this.lastCell = null;
    engine.snapshot(); // one snapshot per stroke => Ctrl+Z undoes the whole stroke
    this.stats.update((value) => ({ ...value, canUndo: true }));
    const { x, y } = this.cellFromEvent(event);
    this.strokeTo(x, y);
    event.preventDefault();
  }

  protected handlePointerMove(event: PointerEvent): void {
    if (!this.painting) {
      return;
    }
    const { x, y } = this.cellFromEvent(event);
    this.strokeTo(x, y);
  }

  protected stopPainting(): void {
    this.painting = false;
    this.lastCell = null;
  }

  protected handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private cellFromEvent(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvas;
    const engine = this.engine;
    if (!canvas || !engine) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * engine.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * engine.height),
    };
  }

  private paintAt(x: number, y: number): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    const elementId = this.erasing ? 0 : (this.selected()?.id ?? 0);
    if (this.tool() === 'boom' && !this.erasing) {
      engine.detonate(x, y, this.brush() + 3);
      return;
    }
    switch (this.shape()) {
      case 'square':
        engine.paint_rect(
          x - this.brush(),
          y - this.brush(),
          x + this.brush(),
          y + this.brush(),
          elementId,
        );
        break;
      case 'spray': {
        const spread = this.brush() * 1.6;
        for (let i = 0; i < 10; i += 1) {
          engine.paint(
            Math.round(x + (Math.random() - 0.5) * spread * 2),
            Math.round(y + (Math.random() - 0.5) * spread * 2),
            Math.max(0, Math.round(this.brush() / 2)),
            elementId,
          );
        }
        break;
      }
      default:
        engine.paint(x, y, this.brush(), elementId);
    }
  }

  // Fast drags deliver sparse pointer events: walk the whole segment so a
  // stroke never has gaps in it.
  private strokeTo(x: number, y: number): void {
    const last = this.lastCell;
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
      for (let i = 1; i <= steps; i += 1) {
        this.paintAt(Math.round(last.x + (dx * i) / steps), Math.round(last.y + (dy * i) / steps));
      }
    } else {
      this.paintAt(x, y);
    }
    this.lastCell = { x, y };
  }

  protected selectElement(entry: ElementEntry | null): void {
    if (!entry) {
      return;
    }
    this.selected.set(entry);
    this.tool.set('paint');
  }

  protected handleUndo(): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    engine.undo();
    this.stats.update((value) => ({ ...value, canUndo: engine.can_undo }));
  }

  protected runPreset(preset: Preset): void {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    try {
      engine.clear(); // snapshots first, so a preset is undoable
      preset.build(engine, (name) => this.byName.get(name)?.id ?? 0);
      this.running.set(true);
      this.stats.update((value) => ({ ...value, canUndo: true }));
    } catch (error) {
      console.error('Failed to build preset:', error);
    }
  }

  protected savePng(): void {
    const canvas = this.canvas;
    if (!canvas) {
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `alkalab-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  protected toggleBoom(): void {
    this.tool.update((value) => (value === 'boom' ? 'paint' : 'boom'));
  }

  protected toggleRunning(): void {
    this.running.update((value) => !value);
  }

  protected step(): void {
    this.running.set(false);
    this.engine?.step();
  }

  protected clear(): void {
    this.engine?.clear();
  }

  protected setBrush(event: Event): void {
    this.brush.set(Number((event.target as HTMLInputElement).value));
  }

  protected setShape(event: Event): void {
    this.shape.set((event.target as HTMLSelectElement).value as Shape);
  }

  protected setSpeed(event: Event): void {
    this.speed.set(Number((event.target as HTMLSelectElement).value));
  }

  // Keyboard shortcuts, mirroring the standalone front end.
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const engine = this.engine;
    if (!engine) {
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
      engine.undo();
      event.preventDefault();
      return;
    }
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === ' ') {
      this.running.update((value) => !value);
    } else if (key === 's') {
      this.running.set(false);
      engine.step();
    } else if (key === 'c') {
      engine.clear();
    } else if (key === 'x') {
      this.toggleBoom();
    } else if (key === 'e') {
      this.selectElement(this.byName.get('Air') ?? null);
    } else if (key >= '1' && key <= '9') {
      this.selectElement(this.byName.get(HOTKEYS[Number(key) - 1]) ?? null);
    } else if (key === '0') {
      this.selectElement(this.byName.get(HOTKEYS[9]) ?? null);
    } else {
      return;
    }
    event.preventDefault();
  };


}

