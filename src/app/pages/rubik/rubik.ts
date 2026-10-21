import { ChangeDetectionStrategy, Component, OnInit, computed } from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';
import { RubikControls } from './rubik-controls';
import { RubikCubeState } from './rubik-cube-state';
import { RubikCubeView } from './rubik-cube-view';
import { RubikNet } from './rubik-net';

const REPO = 'https://github.com/pattygcoding/Rubix-Cube-Solver';

/**
 * The SvelteKit front end this page was ported from, kept as an archive and
 * offered as the second button beside the live repository, the way the portfolio
 * links the legacy Go implementations of Tiger and the JSON/YAML formatter.
 */
const LEGACY_REPO = 'https://github.com/pattygcoding/Rubik-Cube-Solver-Legacy-Svelte';

/**
 * Rubik's Cube solver: paint a cube, let the Rust/WebAssembly two-phase engine
 * solve it, then step through the solution.
 *
 * The page owns the one `RubikCubeState` and hands it to the three views, so
 * the 3D cube, the net and the controls can never disagree about the cube.
 */
@Component({
  selector: 'app-rubik',
  imports: [RepoButton, RubikControls, RubikCubeView, RubikNet],
  templateUrl: './rubik.html',
  styleUrl: './rubik.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rubik implements OnInit {
  protected readonly t = strings;
  protected readonly repo = REPO;
  protected readonly legacyRepo = LEGACY_REPO;

  /** One state object for the whole page; the components share it. */
  protected readonly cube = new RubikCubeState();

  /** The engine's state, for the pill beside the section heading. */
  protected readonly statusLabel = computed(() => this.t.rubik.status[this.cube.status()]);

  ngOnInit(): void {
    void this.cube.init();
  }
}
