import { TestBed } from '@angular/core/testing';
import { Alkalab } from './alkalab';

const REPO = 'https://github.com/pattygcoding/Alkalab';
const LEGACY_REPO = 'https://github.com/pattygcoding/alkalab-legacy';

describe('Alkalab', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Alkalab] }).compileComponents();
  });

  /**
   * The component starts loading its WebAssembly engine in `ngOnInit`.  In the
   * test runner that import fails asynchronously, so give it a turn to settle
   * before the fixture is torn down and its late console error would outlive
   * the worker.
   */
  const settleBoot = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100));

  it('should render the lab canvas and the Nim/WASM eyebrow badge', async () => {
    const fixture = TestBed.createComponent(Alkalab);
    await fixture.whenStable();
    await settleBoot();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('canvas')).not.toBeNull();
    expect(compiled.querySelector('.eyebrow-tech')?.textContent).toContain('NIM / WASM');
    expect(compiled.querySelector('.eyebrow-tech svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should expose the reaction chamber heading and a status line', async () => {
    const fixture = TestBed.createComponent(Alkalab);
    await fixture.whenStable();
    await settleBoot();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#alkalab-lab-title')?.textContent).toBe('Reaction Chamber');
    expect(compiled.querySelector('[role="status"]')?.textContent?.trim()).toBeTruthy();
  });

  it('should link the live repository and the legacy Rust implementation', async () => {
    const fixture = TestBed.createComponent(Alkalab);
    await fixture.whenStable();
    await settleBoot();
    const compiled = fixture.nativeElement as HTMLElement;

    const repo = compiled.querySelector(`a[href="${REPO}"]`);
    expect(repo).not.toBeNull();
    expect(repo?.textContent).toContain('View the repository');

    const legacy = compiled.querySelector(`a[href="${LEGACY_REPO}"]`);
    expect(legacy).not.toBeNull();
    expect(legacy?.textContent).toContain('View legacy Rust implementation');
    expect(legacy?.classList.contains('repo-button--secondary')).toBe(true);
    expect(compiled.querySelectorAll('.alkalab-repo-actions app-repo-button')).toHaveLength(2);
  });
});
