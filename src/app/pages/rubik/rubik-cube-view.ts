import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { format, strings } from '../../i18n/i18n';
import type { RubikCubeState, CubeTransition } from './rubik-cube-state';
import {
  BOX_FACE_NORMALS,
  CORNER_SLOTS,
  EDGE_SLOTS,
  INTERIOR_CSS,
  applyMat3,
  cubieFaceColors,
  placementsFromColors,
  stickerHex,
  stickerIndexAt,
  type CubePlacements,
  type Mat3,
  type Vec3,
} from './rubik-geometry';
import { getSolver } from './rubik-solver';

/**
 * The 3D cube: rendering, click-to-paint raycasting and the pivot animation
 * that turns one layer at a time.
 *
 * The cube is 26 individual `BoxGeometry` meshes on the integer grid, each
 * with six materials (three.js' material order is `+x, -x, +y, -y, +z, -z`).
 *
 * ## How a mesh is kept in sync with the cube
 *
 * A mesh stands for one *slot* of the cube, not for one cubie.  Its position
 * and rotation come from `placementsFromColors(displayed state)`, and its six
 * sticker colours come from the same state, so position and colour are always
 * applied together.  A face turn is animated by attaching the nine meshes of a
 * layer to a temporary group and rotating that group by a multiple of 90
 * degrees; when the turn lands, the meshes are pinned back onto the grid and
 * the state is re-applied.  Because every mesh is an identical box, moving
 * them between slots is invisible - only the stickers matter.
 */

/** Edge length of one sub cube; the gap shows the black core between them. */
const CUBIE_SIZE = 0.94;

/**
 * Size of the black box that fills the middle cell of the 3x3x3 grid.
 *
 * Sub cubes are `CUBIE_SIZE` wide on a grid of spacing 1, so the gap between
 * two of them is 0.06 and their inner faces sit 0.53 from the centre.  A core
 * any larger than that pokes *into* the sub cubes: it slices through the layer
 * that is turning and leaves the cube looking hollow.  Just under 1.06 still
 * blocks the 0.06 wide channels that run straight through the cube - so the
 * page never shows through a gap - while never touching a sub cube.
 */
const CORE_SIZE = 1.04;

const INTERIOR_HEX = Number.parseInt(INTERIOR_CSS.slice(1), 16);
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** The six fixed centre cubies, which never move. */
const CENTRE_POSITIONS: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

interface Cubie {
  readonly mesh: THREE.Mesh;
  readonly materials: THREE.MeshStandardMaterial[];
  readonly kind: 'corner' | 'edge' | 'centre';
  /** Slot this mesh currently represents, `0..7` / `0..11` / `0..5`. */
  readonly slot: number;
}

/** A turn being animated by the render loop. */
interface Tween {
  readonly group: THREE.Group;
  readonly axis: 'x' | 'y' | 'z';
  readonly angle: number;
  readonly duration: number;
  elapsed: number;
  readonly onDone: () => void;
}

@Component({
  selector: 'app-rubik-cube-view',
  templateUrl: './rubik-cube-view.html',
  styleUrl: './rubik-cube-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RubikCubeView implements AfterViewInit, OnDestroy {
  /** The shared cube state, owned by the page. */
  readonly cube = input.required<RubikCubeState>();

  protected readonly t = strings.rubik;

  private readonly containerRef = viewChild.required<ElementRef<HTMLDivElement>>('container');

  /** Set once the scene exists, so the sync effect can wait for it. */
  private readonly ready = signal(false);

  /** Set when the browser cannot give us a WebGL context. */
  protected readonly unavailable = signal(false);

  private cubies: Cubie[] = [];
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private resizeObserver?: ResizeObserver;

  /** The turn currently animating, if any. */
  private tween: Tween | null = null;

  /** Pointer bookkeeping, so orbiting never paints a sticker. */
  private pointerStart: { x: number; y: number; time: number; button: number } | null = null;
  /** Sticker under the pointer, for the hover highlight. */
  private hovered: { mesh: THREE.Mesh; materialIndex: number } | null = null;

  private lastTransitionId = -1;
  private lastColorsKey = '';
  /** Guards against a finished animation overwriting a newer one. */
  private animationToken = 0;

  /** Placements of the displayed cube, recomputed whenever the state changes. */
  private readonly placements = computed<CubePlacements>(() =>
    placementsFromColors(this.cube().displayColors()),
  );

  /** Badge text in the corner of the canvas. */
  protected readonly badge = computed(() => {
    const cube = this.cube();
    if (cube.playing()) {
      return format(this.t.cube.playing, { cursor: cube.cursor(), total: cube.moves().length });
    }
    if (!cube.hasSolution()) return this.t.cube.no_solution;
    if (cube.isSolved()) return this.t.cube.solved;
    return format(this.t.cube.moves, { cursor: cube.cursor(), total: cube.moves().length });
  });

  /** Label of the mobile play button floating over the cube. */
  protected readonly playLabel = computed(() => {
    const cube = this.cube();
    if (cube.playing()) return this.t.playback.pause;
    return cube.hasSolution() ? this.t.playback.play : this.t.playback.solve_and_play;
  });

  /** Why the mobile play button is (or is not) available. */
  protected readonly playReason = computed(() => {
    const cube = this.cube();
    if (cube.playing()) return this.t.playback.pause;
    if (cube.isBusy()) return this.t.solve.reason_busy;
    if (cube.isPaintedSolved()) return this.t.playback.reason_solved;
    if (!cube.isSolvable()) return cube.validation().message;
    return cube.hasSolution() ? this.t.playback.reason_play : this.t.playback.reason_solve_play;
  });

  private readonly timer = new THREE.Timer();

  constructor() {
    // One effect drives the whole scene.  A turn is animated, and the state is
    // only re-applied once it has landed: painting the slots while the meshes
    // are mid-turn would put the stickers of the new state onto the old
    // arrangement.  Everything else - a jump, a reset, a repaint - is applied
    // immediately.  `ready` is read too, so the first paint after the scene is
    // built runs even when the cube state has not changed yet.
    effect(() => {
      if (!this.ready()) return;
      const transition = this.cube().transition();
      const colorsKey = this.cube().displayColors().join('');
      const newTransition = transition.id !== this.lastTransitionId;
      const newColors = colorsKey !== this.lastColorsKey;
      if (!newTransition && !newColors) return;

      this.lastTransitionId = transition.id;
      this.lastColorsKey = colorsKey;

      if (
        newTransition &&
        transition.move &&
        (transition.kind === 'move' || transition.kind === 'undo')
      ) {
        void this.runMove(transition);
        return;
      }
      this.finishTween();
      this.syncScene();
    });
  }

  ngAfterViewInit(): void {
    this.buildScene();
    this.applyPlacements(this.placements());
    this.applyColors(this.placements(), this.cube().displayColors());
    this.ready.set(true);
  }

  ngOnDestroy(): void {
    const canvas = this.renderer?.domElement;
    this.resizeObserver?.disconnect();
    canvas?.removeEventListener('pointerdown', this.onPointerDown);
    canvas?.removeEventListener('pointerup', this.onPointerUp);
    canvas?.removeEventListener('pointermove', this.onPointerMove);
    canvas?.removeEventListener('pointerleave', this.onPointerLeave);
    canvas?.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer?.setAnimationLoop(null);
    this.controls?.dispose();
    this.renderer?.dispose();
    canvas?.parentElement?.removeChild(canvas);
  }

  // -- scene --------------------------------------------------------------

  /**
   * Style the canvas three.js creates.
   *
   * It is not part of the template, so Angular's emulated encapsulation cannot
   * reach it - the rules in `rubik-cube-view.css` would not match a canvas with
   * no style scope - so its layout rules are applied here instead.
   */
  private styleCanvas(canvas: HTMLCanvasElement): void {
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'crosshair';
    canvas.style.touchAction = 'none';
  }

  private buildScene(): void {
    // The stage needs a WebGL context, which a headless test runner (or an old
    // browser) cannot give.  Asking for one up front keeps that a quiet fallback
    // rather than a logged exception, and the rest of the page carries on: the 2D
    // net paints the cube and the controls solve it.
    if (!supportsWebGl()) {
      this.unavailable.set(true);
      return;
    }
    try {
      this.createScene(this.containerRef().nativeElement);
    } catch (error) {
      // The feature check passed but the context still could not be created,
      // which is unusual enough to be worth saying out loud.
      console.warn('Failed to start the 3D view:', error);
      this.unavailable.set(true);
    }
  }

  private createScene(container: HTMLDivElement): void {
    const scene = new THREE.Scene();
    scene.background = null;
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(4.6, 4.2, 5.6);
    camera.lookAt(0, 0, 0);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.classList.add('cube-canvas');
    this.styleCanvas(renderer.domElement);
    this.renderer = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = false;
    controls.minDistance = 5.5;
    controls.maxDistance = 16;
    controls.rotateSpeed = 0.9;
    this.controls = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(6, 9, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.1);
    fill.position.set(-7, -4, -6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(-4, 6, -8);
    scene.add(rim);

    const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    scene.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(CORE_SIZE, CORE_SIZE, CORE_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9, metalness: 0 }),
      ),
    );

    const cubies: Cubie[] = [];
    for (let slot = 0; slot < 8; slot++) {
      cubies.push(this.createCubie(geometry, 'corner', slot, CORNER_SLOTS[slot].position));
    }
    for (let slot = 0; slot < 12; slot++) {
      cubies.push(this.createCubie(geometry, 'edge', slot, EDGE_SLOTS[slot].position));
    }
    for (let slot = 0; slot < 6; slot++) {
      cubies.push(this.createCubie(geometry, 'centre', slot, CENTRE_POSITIONS[slot]));
    }
    for (const cubie of cubies) scene.add(cubie.mesh);
    this.cubies = cubies;

    container.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    renderer.domElement.addEventListener('contextmenu', this.onContextMenu);

    this.resize();
    // jsdom (the unit tests) has no ResizeObserver.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
    this.timer.connect(document);
    renderer.setAnimationLoop(this.renderFrame);

    if (isDevMode()) {
      // Handy while developing: inspect the scene from the browser console.
      (globalThis as unknown as Record<string, unknown>)['__cubeView'] = {
        scene,
        camera,
        cubies,
        placements: () => this.placements(),
        tween: () => this.tween,
        pick: (clientX: number, clientY: number) =>
          this.pickSticker({ clientX, clientY } as PointerEvent),
      };
    }
  }

  /** Placement of one mesh slot in a given state. */
  private placementFor(cubie: Cubie, state: CubePlacements) {
    if (cubie.kind === 'corner') return state.corners[cubie.slot];
    if (cubie.kind === 'edge') return state.edges[cubie.slot];
    return {
      slot: cubie.slot,
      cubie: 0,
      position: CENTRE_POSITIONS[cubie.slot],
      rotation: IDENTITY,
      uncertain: false,
    };
  }

  private matrix4From(m: Mat3): THREE.Matrix4 {
    return new THREE.Matrix4().set(
      m[0], m[1], m[2], 0,
      m[3], m[4], m[5], 0,
      m[6], m[7], m[8], 0,
      0, 0, 0, 1,
    );
  }

  /** Turn a quaternion that is already a multiple of 90 degrees into a matrix. */
  private mat3FromQuaternion(quaternion: THREE.Quaternion): Mat3 {
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
    const e = matrix.elements;
    return [
      Math.round(e[0]),
      Math.round(e[4]),
      Math.round(e[8]),
      Math.round(e[1]),
      Math.round(e[5]),
      Math.round(e[9]),
      Math.round(e[2]),
      Math.round(e[6]),
      Math.round(e[10]),
    ];
  }

  /** Put every mesh exactly where the state says it belongs, without animating. */
  private applyPlacements(state: CubePlacements): void {
    for (const cubie of this.cubies) {
      const placement = this.placementFor(cubie, state);
      if (!placement) continue;
      const [x, y, z] = placement.position;
      cubie.mesh.position.set(x, y, z);
      cubie.mesh.quaternion.setFromRotationMatrix(this.matrix4From(placement.rotation));
      cubie.mesh.updateMatrix();
    }
  }

  /** Paint the six materials of every mesh from the same state. */
  private applyColors(state: CubePlacements, colors: readonly number[]): void {
    for (const cubie of this.cubies) {
      const placement = this.placementFor(cubie, state);
      if (!placement) continue;
      const faceColors = cubieFaceColors(placement, colors);
      for (let face = 0; face < 6; face++) {
        // `stickerHex` already distinguishes an empty sticker from the inside
        // of the cube, so `null` needs no special case here.
        cubie.materials[face].color.setHex(stickerHex(faceColors[face]));
      }
    }
  }

  /** Everything the scene needs to match the cube state, applied together. */
  private syncScene(): void {
    const placements = this.placements();
    this.applyPlacements(placements);
    this.applyColors(placements, this.cube().displayColors());
  }

  // -- turns --------------------------------------------------------------

  /** Animate one turn, then pin the meshes back onto the state. */
  private async runMove(transition: CubeTransition): Promise<void> {
    const token = ++this.animationToken;
    this.finishTween();

    const solver = getSolver();
    const moveIndex = transition.move === null ? undefined : solver?.moveIndex(transition.move);
    const turn =
      moveIndex === undefined || moveIndex === null ? null : (solver?.moveTurn(moveIndex) ?? null);
    if (!turn) {
      this.syncScene();
      return;
    }
    await this.animateTurn(turn, transition.kind === 'move' ? 1 : -1);
    if (token !== this.animationToken) return;
    this.syncScene();
  }

  /**
   * Attach the nine meshes of a layer to a temporary group and rotate it.
   *
   * The group sits at the origin, so rotating it by a multiple of 90 degrees
   * turns exactly that layer.  The rotation always takes the shortest way round:
   * a move like `F'` is three quarter turns in the solver's encoding, but
   * spinning the layer 270 degrees looks wrong, so it is played as -90 degrees
   * instead.
   */
  private animateTurn(turn: [number, number, number], direction: 1 | -1): Promise<void> {
    const scene = this.scene;
    if (!scene) return Promise.resolve();

    const axis = (['x', 'y', 'z'] as const)[turn[0]];
    const layer = turn[1];
    const quarters = (((turn[2] % 4) + 4) % 4) as 0 | 1 | 2 | 3;
    const shortest = quarters === 3 ? -1 : quarters;
    const angle = (shortest * direction * Math.PI) / 2;

    const group = new THREE.Group();
    scene.add(group);
    for (const cubie of this.cubies) {
      if (Math.round(cubie.mesh.position[axis]) === layer) group.attach(cubie.mesh);
    }

    return new Promise<void>((resolve) => {
      this.tween = {
        group,
        axis,
        angle,
        duration: Math.max(120, Math.min(600, this.cube().speed() * 0.75)),
        elapsed: 0,
        onDone: () => {
          group.rotation[axis] = angle;
          group.updateMatrixWorld(true);
          for (const child of [...group.children]) {
            scene.attach(child);
            this.roundMesh(child as THREE.Mesh);
          }
          scene.remove(group);
          resolve();
        },
      };
    });
  }

  /**
   * Snap a mesh back onto the integer grid and to the nearest 90 degree
   * orientation, so hundreds of turns cannot accumulate float drift.
   */
  private roundMesh(mesh: THREE.Mesh): void {
    mesh.position.set(
      Math.round(mesh.position.x),
      Math.round(mesh.position.y),
      Math.round(mesh.position.z),
    );
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(mesh.quaternion);
    const elements = matrix.elements;
    for (let i = 0; i < 16; i++) elements[i] = Math.round(elements[i]);
    mesh.quaternion.setFromRotationMatrix(matrix);
    mesh.updateMatrix();
  }

  /** Complete a running animation immediately. */
  private finishTween(): void {
    const pending = this.tween;
    if (!pending) return;
    this.tween = null;
    pending.onDone();
  }

  /** One sub cube with its six face materials. */
  private createCubie(
    geometry: THREE.BoxGeometry,
    kind: Cubie['kind'],
    slot: number,
    home: Vec3,
  ): Cubie {
    const materials = BOX_FACE_NORMALS.map(
      () =>
        new THREE.MeshStandardMaterial({
          color: INTERIOR_HEX,
          roughness: 0.42,
          metalness: 0.04,
        }),
    );
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(home[0], home[1], home[2]);
    return { mesh, materials, kind, slot };
  }

  // -- painting -----------------------------------------------------------

  /**
   * Raycast the pointer against the 26 sub cubes and translate the hit into a
   * facelet index.
   *
   * A sticker is identified by the grid point of the sub cube plus the *world*
   * normal of the hit face, which is exactly how the facelet tables are keyed.
   */
  private pickSticker(event: PointerEvent) {
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, camera);
    const hits = this.raycaster.intersectObjects(
      this.cubies.map((cubie) => cubie.mesh),
      false,
    );
    const hit = hits[0];
    if (!hit || !hit.face) return null;
    const mesh = hit.object as THREE.Mesh;
    const materialIndex = hit.face.materialIndex ?? Math.floor((hit.faceIndex ?? 0) / 2);
    const position: Vec3 = [
      Math.round(mesh.position.x),
      Math.round(mesh.position.y),
      Math.round(mesh.position.z),
    ];
    const worldNormal = applyMat3(
      this.mat3FromQuaternion(mesh.quaternion),
      BOX_FACE_NORMALS[materialIndex],
    );
    const facelet = stickerIndexAt(position, worldNormal);
    return facelet === undefined ? null : { facelet, mesh, materialIndex };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) return;
    this.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      button: event.button,
    };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (!start || start.button !== event.button) return;
    // Orbiting drags the pointer, so only a short, still press paints.
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    if (performance.now() - start.time > 800) return;
    // Never pick mid turn: the meshes are inside the pivot group.
    if (this.tween) return;
    const pick = this.pickSticker(event);
    if (!pick) return;
    this.clearHover();
    const cube = this.cube();
    if (event.button === 2 || event.shiftKey) cube.eraseSticker(pick.facelet);
    else cube.paintSticker(pick.facelet, cube.activeColor());
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerStart || this.tween) return;
    const pick = this.pickSticker(event);
    if (!pick) {
      this.clearHover();
      return;
    }
    if (this.hovered && this.hovered.mesh === pick.mesh && this.hovered.materialIndex === pick.materialIndex) {
      return;
    }
    this.clearHover();
    this.hovered = pick;
    (pick.mesh.material as THREE.MeshStandardMaterial[])[pick.materialIndex].emissive.setHex(
      0x2a2f3a,
    );
  };

  private readonly onPointerLeave = (): void => {
    this.clearHover();
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private clearHover(): void {
    if (!this.hovered) return;
    const materials = this.hovered.mesh.material as THREE.MeshStandardMaterial[];
    materials[this.hovered.materialIndex]?.emissive.setHex(0x000000);
    this.hovered = null;
  }

  // -- rendering ----------------------------------------------------------

  private readonly renderFrame = (timestamp?: number): void => {
    this.timer.update(timestamp);
    const delta = this.timer.getDelta();
    if (this.tween) {
      this.tween.elapsed += delta * 1000;
      const t = Math.min(1, this.tween.elapsed / this.tween.duration);
      // ease in and out, so a turn starts and stops smoothly
      const eased = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      this.tween.group.rotation[this.tween.axis] = this.tween.angle * eased;
      if (t >= 1) {
        const finished = this.tween;
        this.tween = null;
        finished.onDone();
      }
    }
    this.controls?.update();
    if (this.scene && this.camera) this.renderer?.render(this.scene, this.camera);
  };

  private resize(): void {
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera) return;
    const container = this.containerRef().nativeElement;
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

/** True when the browser can hand three.js a WebGL 2 context. */
function supportsWebGl(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
