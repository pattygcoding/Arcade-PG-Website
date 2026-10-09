import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';

/** The Rust/WASM game is driven by miniquad's JS bundle, loaded from a CDN. */
const MINIQUAD_BUNDLE_URL = 'https://not-fl3.github.io/miniquad-samples/mq_js_bundle.js';
const WASM_URL = '/wasm/snake.wasm';

type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

interface MiniquadWindow extends Window {
  load?: (url: string) => void;
}

@Component({
  selector: 'app-snake',
  imports: [RepoButton],
  templateUrl: './snake.html',
  styleUrl: './snake.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Snake implements OnInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly t = strings;
  protected readonly status = signal(strings.snake.status.loading);
  protected readonly ariaLabel = strings.snake.aria_label;

  private runtimeScript?: HTMLScriptElement;

  ngOnInit(): void {
    this.loadRuntime();
  }

  ngOnDestroy(): void {
    this.runtimeScript?.remove();
  }

  /** Pointer press: mirror it as a keydown on the canvas, focusing first. */
  protected press(event: Event, code: Direction): void {
    event.preventDefault();
    const currentTarget = event.currentTarget as HTMLElement | null;
    currentTarget?.setPointerCapture?.((event as PointerEvent).pointerId);
    this.sendDirectionEvent(code, 'keydown');
  }

  /** Pointer release: mirror it as a keyup on the canvas. */
  protected release(event: Event, code: Direction): void {
    event.preventDefault();
    this.sendDirectionEvent(code, 'keyup');
  }

  /**
   * Keyboard activation must not steal focus from the button, so it sends a
   * keydown/keyup pair without focusing the canvas first (detail === 0 marks a
   * click triggered by the keyboard rather than a pointer).
   */
  protected onButtonClick(event: MouseEvent, code: Direction): void {
    if (event.detail === 0) {
      this.sendDirectionEvent(code, 'keydown', false);
      this.sendDirectionEvent(code, 'keyup', false);
    }
  }

  private sendDirectionEvent(code: Direction, type: 'keydown' | 'keyup', focusCanvas = true): void {
    const canvas = this.canvasRef().nativeElement;
    if (focusCanvas) {
      canvas.focus({ preventScroll: true });
    }
    canvas.dispatchEvent(
      new KeyboardEvent(type, { key: code, code, bubbles: true, cancelable: true }),
    );
  }

  private loadRuntime(): void {
    const script = document.createElement('script');
    script.src = MINIQUAD_BUNDLE_URL;
    script.async = true;

    script.onload = () => {
      try {
        const load = (window as MiniquadWindow).load;
        if (!load) {
          throw new Error('miniquad runtime is unavailable');
        }
        load(WASM_URL);
        this.status.set(strings.snake.status.ready);
      } catch (error) {
        console.error('Failed to start Snake:', error);
        this.status.set(strings.snake.status.start_failed);
      }
    };

    script.onerror = () => this.status.set(strings.snake.status.runtime_failed);

    document.body.appendChild(script);
    this.runtimeScript = script;
  }
}
