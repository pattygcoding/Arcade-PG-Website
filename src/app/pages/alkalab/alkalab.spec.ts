import { TestBed } from '@angular/core/testing';
import { Alkalab } from './alkalab';

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

  it('should render the lab canvas and the Rust/WASM eyebrow badge', async () => {
    const fixture = TestBed.createComponent(Alkalab);
    await fixture.whenStable();
    await settleBoot();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('canvas')).not.toBeNull();
    expect(compiled.querySelector('.eyebrow-tech')?.textContent).toContain('RUST / WASM');
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
});
