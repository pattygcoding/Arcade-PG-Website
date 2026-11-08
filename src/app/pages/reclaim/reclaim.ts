import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';

/**
 * Reclaim 4160 is an Emscripten build (C++/SDL2 -> WebAssembly). It ships as a
 * self-contained page under /wasm/reclaim/, so it is embedded in an iframe and the
 * touch controls forward synthesized key events into the frame, exactly the way the
 * Snake page forwards its D-pad to its canvas.
 */
const GAME_URL = '/wasm/reclaim/reclaim.html';

type GameKey = 'ArrowLeft' | 'ArrowRight' | 'Space';

@Component({
  selector: 'app-reclaim',
  imports: [RepoButton],
  templateUrl: './reclaim.html',
  styleUrl: './reclaim.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reclaim {
  private readonly frameRef = viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly t = strings;
  protected readonly status = signal(strings.reclaim.status.loading);
  protected readonly ariaLabel = strings.reclaim.aria_label;
  protected readonly gameUrl: SafeResourceUrl;

  constructor(sanitizer: DomSanitizer) {
    this.gameUrl = sanitizer.bypassSecurityTrustResourceUrl(GAME_URL);
  }

  protected onFrameLoad(): void {
    this.status.set(strings.reclaim.status.ready);
  }

  /** Pointer press: hold the key down while the button is held. */
  protected press(event: Event, code: GameKey): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.((event as PointerEvent).pointerId);
    this.sendKey(code, 'keydown');
  }

  /** Pointer release: lift the key. */
  protected release(event: Event, code: GameKey): void {
    event.preventDefault();
    this.sendKey(code, 'keyup');
  }

  /**
   * Keyboard activation must not steal focus from the button, so it sends a
   * keydown/keyup pair without focusing the frame (detail === 0 marks a click
   * triggered by the keyboard rather than a pointer).
   */
  protected onButtonClick(event: MouseEvent, code: GameKey): void {
    if (event.detail === 0) {
      this.sendKey(code, 'keydown');
      this.sendKey(code, 'keyup');
    }
  }

  /** Forwards a synthesized key event into the embedded game's document. */
  private sendKey(code: GameKey, type: 'keydown' | 'keyup'): void {
    const frame = this.frameRef().nativeElement;
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) return;

    win.focus();
    const canvas = doc.querySelector('canvas') as HTMLElement | null;
    canvas?.focus();

    const key = code === 'Space' ? ' ' : code;
    // Bubble from the body so both document-level and window-level listeners see it.
    (doc.body ?? doc).dispatchEvent(
      new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }),
    );
  }
}
