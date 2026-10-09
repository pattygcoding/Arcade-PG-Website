import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { strings } from './i18n/i18n';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Escape closes the phone drawer, like any other overlay.
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly t = strings;

  /** The phone drawer; the inline links take over from `sm` up. */
  protected readonly menuOpen = signal(false);

  protected openMenu(): void {
    this.menuOpen.set(true);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}



