import { TestBed } from '@angular/core/testing';
import { Rustcraft } from './rustcraft';

const REPO = 'https://github.com/pattygcoding/Rustcraft';
const SHOT_SOURCES = [
  'assets/images/rustcraft/world.png',
  'assets/images/rustcraft/caves.png',
  'assets/images/rustcraft/house.png',
];

describe('Rustcraft', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Rustcraft] }).compileComponents();
  });

  it('should render the showcase with a slide per screenshot', async () => {
    const fixture = TestBed.createComponent(Rustcraft);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toBe('Rustcraft');
    expect(compiled.querySelectorAll('.rustcraft-feature')).toHaveLength(4);
    expect(compiled.querySelectorAll('.rustcraft-tags li').length).toBeGreaterThan(0);

    const slides = compiled.querySelectorAll('.rustcraft-slide');
    expect(slides).toHaveLength(SHOT_SOURCES.length);
    SHOT_SOURCES.forEach((src, index) => {
      expect(slides[index].querySelector('img')?.getAttribute('src')).toBe(src);
    });
  });

  it('should advance and rewind the carousel and expose a live status', async () => {
    const fixture = TestBed.createComponent(Rustcraft);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const status = () => compiled.querySelector('.rustcraft-carousel__status')?.textContent;

    expect(status()).toContain('1 of 3');

    compiled.querySelector<HTMLButtonElement>('button[aria-label="Next screenshot"]')?.click();
    await fixture.whenStable();
    expect(status()).toContain('2 of 3');
    expect(compiled.querySelectorAll('.rustcraft-dot.is-active')).toHaveLength(1);
    expect(compiled.querySelectorAll('.rustcraft-slide')[0].getAttribute('aria-hidden')).toBe('true');

    compiled.querySelector<HTMLButtonElement>('button[aria-label="Previous screenshot"]')?.click();
    await fixture.whenStable();
    expect(status()).toContain('1 of 3');

    // The last slide wraps forward to the first.
    compiled.querySelector<HTMLButtonElement>('button[aria-label="Previous screenshot"]')?.click();
    await fixture.whenStable();
    expect(status()).toContain('3 of 3');
  });

  it('should jump to a slide from a dot and via the arrow keys', async () => {
    const fixture = TestBed.createComponent(Rustcraft);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const status = () => compiled.querySelector('.rustcraft-carousel__status')?.textContent;

    compiled.querySelector<HTMLButtonElement>('button[aria-label="Go to screenshot 3"]')?.click();
    await fixture.whenStable();
    expect(status()).toContain('3 of 3');

    const carousel = compiled.querySelector('.rustcraft-carousel') as HTMLElement;
    carousel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();
    expect(status()).toContain('1 of 3');
  });

  it('should link to the repository safely', async () => {
    const fixture = TestBed.createComponent(Rustcraft);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const repo = compiled.querySelector(`a[href="${REPO}"]`);
    expect(repo).not.toBeNull();
    expect(repo?.getAttribute('target')).toBe('_blank');
    expect(repo?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
