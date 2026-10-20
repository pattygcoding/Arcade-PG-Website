import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { format, strings } from '../../i18n/i18n';
import { CENTRE_STICKERS, colorName, type RubixCubeState } from './rubix-cube-state';
import { FACE_COLORS, stickerCss, type FaceId } from './rubix-geometry';

/**
 * The unfolded net of the cube, for quick painting and inspection.
 *
 * It shows the *displayed* cube, so it stays in sync with the 3D view while a
 * solution is playing.  Stickers are painted with the active palette colour;
 * right clicking or shift clicking clears a sticker.
 *
 * The layout is the classic Kociemba net - the same one the solver's facelet
 * string is written in:
 *
 * ```text
 *            U
 *      L     F     R     B
 *            D
 * ```
 *
 * Row 0 of `U` is the row furthest from the viewer (the back of the cube) and
 * row 0 of `D` is the row nearest to the viewer, which is what makes the
 * unfolded cross fold up without mirroring anything.
 */

/** Which face goes where in the 4x3 net. */
interface NetFace {
  readonly face: FaceId;
  readonly row: number;
  readonly column: number;
}

const NET_LAYOUT: readonly NetFace[] = [
  { face: 0, row: 1, column: 2 }, // U
  { face: 4, row: 2, column: 1 }, // L
  { face: 2, row: 2, column: 2 }, // F
  { face: 1, row: 2, column: 3 }, // R
  { face: 5, row: 2, column: 4 }, // B
  { face: 3, row: 3, column: 2 }, // D
];

/** The nine stickers of a face, in facelet order. */
const POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

@Component({
  selector: 'app-rubix-net',
  templateUrl: './rubix-net.html',
  styleUrl: './rubix-net.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RubixNet {
  /** The shared cube state, owned by the page. */
  readonly cube = input.required<RubixCubeState>();

  protected readonly t = strings.rubix;
  protected readonly faces = NET_LAYOUT;
  protected readonly positions = POSITIONS;

  /** Is the net open? */
  protected readonly open = signal(true);

  /** Sticker colours of the displayed cube. */
  protected readonly cells = computed(() => this.cube().displayColors());

  protected letter(face: FaceId): string {
    return FACE_COLORS[face].letter;
  }

  /** Facelet index of a sticker, `face * 9 + row * 3 + column`. */
  protected index(face: FaceId, position: number): number {
    return face * 9 + position;
  }

  protected isCentre(index: number): boolean {
    return CENTRE_STICKERS.includes(index);
  }

  protected isUnknown(index: number): boolean {
    return (this.cells()[index] ?? 6) >= 6;
  }

  protected background(index: number): string {
    return stickerCss(this.cells()[index]);
  }

  protected cellLabel(face: FaceId, position: number): string {
    return format(this.t.net.cell, {
      face: FACE_COLORS[face].letter,
      position: position + 1,
      color: colorName(this.cells()[face * 9 + position]),
    });
  }

  protected title(face: FaceId, position: number): string {
    return this.isCentre(this.index(face, position))
      ? this.t.net.centre_fixed
      : this.cellLabel(face, position);
  }

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected paint(event: MouseEvent, index: number): void {
    if (event.shiftKey) {
      this.cube().eraseSticker(index);
      return;
    }
    this.cube().paintSticker(index, this.cube().activeColor());
  }

  protected erase(event: MouseEvent, index: number): void {
    event.preventDefault();
    this.cube().eraseSticker(index);
  }
}
