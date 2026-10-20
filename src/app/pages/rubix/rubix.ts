import { ChangeDetectionStrategy, Component, OnInit, computed } from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';
import { RubixControls } from './rubix-controls';
import { RubixCubeState } from './rubix-cube-state';
import { RubixCubeView } from './rubix-cube-view';
import { RubixNet } from './rubix-net';

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
 * The page owns the one `RubixCubeState` and hands it to the three views, so
 * the 3D cube, the net and the controls can never disagree about the cube.
 */
@Component({
  selector: 'app-rubix',
  imports: [RepoButton, RubixControls, RubixCubeView, RubixNet],
  templateUrl: './rubix.html',
  styleUrl: './rubix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rubix implements OnInit {
  protected readonly t = strings;
  protected readonly repo = REPO;
  protected readonly legacyRepo = LEGACY_REPO;

  /** One state object for the whole page; the components share it. */
  protected readonly cube = new RubixCubeState();

  /** The engine's state, for the pill beside the section heading. */
  protected readonly statusLabel = computed(() => this.t.rubix.status[this.cube.status()]);

  ngOnInit(): void {
    void this.cube.init();
  }
}
