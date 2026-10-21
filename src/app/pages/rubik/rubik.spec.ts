import { TestBed } from '@angular/core/testing';
import { Rubik } from './rubik';

const REPO = 'https://github.com/pattygcoding/Rubix-Cube-Solver';
const LEGACY_REPO = 'https://github.com/pattygcoding/Rubik-Cube-Solver-Legacy-Svelte';

describe('Rubik', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Rubik] }).compileComponents();
  });

  it('should render the heading, the stage and the engine status', async () => {
    const fixture = TestBed.createComponent(Rubik);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain("Rubik's Cube Solver");
    expect(compiled.querySelector('app-rubik-cube-view')).not.toBeNull();
    expect(compiled.querySelector('app-rubik-controls')).not.toBeNull();
    expect(compiled.querySelector('[role="status"]')?.textContent?.trim()).toBeTruthy();
  });

  it('should link the live repository and the legacy Svelte one', async () => {
    const fixture = TestBed.createComponent(Rubik);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const repo = compiled.querySelector(`a[href="${REPO}"]`);
    expect(repo).not.toBeNull();
    expect(repo?.getAttribute('target')).toBe('_blank');
    expect(repo?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(repo?.textContent).toContain('View the repository');

    const legacy = compiled.querySelector(`a[href="${LEGACY_REPO}"]`);
    expect(legacy).not.toBeNull();
    expect(legacy?.getAttribute('target')).toBe('_blank');
    expect(legacy?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(legacy?.textContent).toContain('View legacy Svelte implementation');
    // The legacy link wears the outlined variant, and the two sit in one row.
    expect(legacy?.classList.contains('repo-button--secondary')).toBe(true);
    expect(repo?.classList.contains('repo-button--secondary')).toBe(false);
    expect(compiled.querySelectorAll('.rubik-repo-actions app-repo-button')).toHaveLength(2);
  });

  it('should offer a sticker per facelet in the unfolded net', async () => {
    const fixture = TestBed.createComponent(Rubik);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-rubik-net .sticker')).toHaveLength(54);
    // The six centres are fixed: they are what identifies a face.
    expect(compiled.querySelectorAll('app-rubik-net .sticker[disabled]')).toHaveLength(6);
  });

  it('should offer the palette, the solve actions and the transport', async () => {
    const fixture = TestBed.createComponent(Rubik);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    // Six colours plus the eraser; a solved cube has nothing unpainted, so the
    // "still to paint" chip is not there yet, and the same six counts are.
    expect(compiled.querySelectorAll('app-rubik-controls .swatch')).toHaveLength(7);
    expect(compiled.querySelectorAll('app-rubik-controls .count')).toHaveLength(6);
    expect(compiled.querySelectorAll('app-rubik-controls .transport button')).toHaveLength(4);
  });

  it('should offer a second play control beside the cube for phones', async () => {
    const fixture = TestBed.createComponent(Rubik);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const play = compiled.querySelector<HTMLButtonElement>('app-rubik-cube-view .mobile-play');
    expect(play).not.toBeNull();
    // A solved cube cannot be played, but the control is still there, disabled,
    // with the same label as the sidebar transport.
    expect(play?.disabled).toBe(true);
    expect(play?.textContent).toContain('Solve & play');
  });

  it('should paint a sticker with the selected palette colour', async () => {
    const fixture = TestBed.createComponent(Rubik);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    // A solved cube starts with nine of every colour, so a miscount in the
    // counts row is proof that the sticker was painted.
    const red = () => compiled.querySelectorAll('app-rubik-controls .count .num')[1]?.textContent;
    expect(red()).toBe('9');

    compiled.querySelectorAll<HTMLButtonElement>('app-rubik-controls .swatch')[1].click();
    await fixture.whenStable();

    compiled.querySelectorAll<HTMLButtonElement>('app-rubik-net .sticker')[0].click();
    await fixture.whenStable();

    expect(red()).toBe('10');
    expect(compiled.querySelectorAll('app-rubik-controls .count.is-bad')).toHaveLength(2);
  });
});
