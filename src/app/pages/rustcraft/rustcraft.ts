import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';

const REPO = 'https://github.com/pattygcoding/Rustcraft';

interface Shot {
  /** Path under `public/`, served from the build root. */
  src: string;
  /** Translated alt text, from `en.json`. */
  alt: string;
  /** Translated one-line caption, from `en.json`. */
  caption: string;
}

// The screenshots in the carousel.  Only the source path lives here (it is not
// language); the alt text and caption come from en.json.  Add a new PNG under
// `public/assets/images/rustcraft/` and a matching block in en.json's
// `rustcraft.gallery.shots`, then list it here to grow the carousel.
const SHOTS: readonly Shot[] = [
  {
    src: 'assets/images/rustcraft/world.png',
    alt: strings.rustcraft.gallery.shots.world.alt,
    caption: strings.rustcraft.gallery.shots.world.caption,
  },
  {
    src: 'assets/images/rustcraft/caves.png',
    alt: strings.rustcraft.gallery.shots.caves.alt,
    caption: strings.rustcraft.gallery.shots.caves.caption,
  },
  {
    src: 'assets/images/rustcraft/house.png',
    alt: strings.rustcraft.gallery.shots.house.alt,
    caption: strings.rustcraft.gallery.shots.house.caption,
  },
];

interface Feature {
  key: 'world' | 'terrain' | 'lighting' | 'building';
  title: string;
  text: string;
}

const FEATURES: readonly Feature[] = [
  {
    key: 'world',
    title: strings.rustcraft.features.world.title,
    text: strings.rustcraft.features.world.text,
  },
  {
    key: 'terrain',
    title: strings.rustcraft.features.terrain.title,
    text: strings.rustcraft.features.terrain.text,
  },
  {
    key: 'lighting',
    title: strings.rustcraft.features.lighting.title,
    text: strings.rustcraft.features.lighting.text,
  },
  {
    key: 'building',
    title: strings.rustcraft.features.building.title,
    text: strings.rustcraft.features.building.text,
  },
];

/** A horizontal swipe has to clear this many pixels to advance a slide. */
const SWIPE_THRESHOLD = 40;

@Component({
  selector: 'app-rustcraft',
  imports: [RepoButton],
  templateUrl: './rustcraft.html',
  styleUrl: './rustcraft.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rustcraft {
  protected readonly t = strings;
  protected readonly repo = REPO;
  protected readonly shots = SHOTS;
  protected readonly features = FEATURES;
  protected readonly stack = strings.rustcraft.build.stack_items;

  /** Index of the visible slide. */
  protected readonly index = signal(0);

  /** `Screenshot 2 of 3`, with both numbers substituted into the locale string. */
  protected readonly slideStatus = computed(() =>
    this.t.rustcraft.gallery.slide_status
      .replace('{{current}}', String(this.index() + 1))
      .replace('{{total}}', String(this.shots.length)),
  );

  protected goTo(index: number): void {
    this.index.set(index);
  }

  protected next(): void {
    this.index.update((index) => (index + 1) % this.shots.length);
  }

  protected prev(): void {
    this.index.update((index) => (index - 1 + this.shots.length) % this.shots.length);
  }

  /** Dot tooltip/aria label, `Go to screenshot 2`. */
  protected dotLabel(index: number): string {
    return this.t.rustcraft.gallery.go_to.replace('{{n}}', String(index + 1));
  }

  // Pointer swipe: remember where a drag began, then decide on release.  Kept on
  // the instance rather than a signal because it never drives the template.
  private pointerStartX: number | null = null;

  protected onPointerDown(event: PointerEvent): void {
    this.pointerStartX = event.clientX;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.pointerStartX === null) {
      return;
    }
    const delta = event.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      return;
    }
    if (delta < 0) {
      this.next();
    } else {
      this.prev();
    }
  }

  /** Left/right arrows step the carousel while it holds focus. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.prev();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else {
      return;
    }
    event.preventDefault();
  }
}
