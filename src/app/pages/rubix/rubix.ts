import { ChangeDetectionStrategy, Component, OnInit, computed } from '@angular/core';
import { RepoButton } from '../../components/repo-button/repo-button';
import { strings } from '../../i18n/i18n';
import { RubixControls } from './rubix-controls';
import { RubixCubeState } from './rubix-cube-state';
import { RubixCubeView } from './rubix-cube-view';
import { RubixNet } from './rubix-net';

const REPO = 'https://github.com/pattygcoding/Rubix-Cube-Solver';

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

  /** One state object for the whole page; the components share it. */
  protected readonly cube = new RubixCubeState();

  /** The engine's state, for the pill beside the section heading. */
  protected readonly statusLabel = computed(() => this.t.rubix.status[this.cube.status()]);

  ngOnInit(): void {
    void this.cube.init();
  }
}
