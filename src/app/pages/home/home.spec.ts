import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the arcade heading', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent).toContain('Patrick Goodwin');
    expect(h1?.textContent).toContain('Arcade');
  });

  it('should offer a selection card per game', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a[href="/alkalab"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/rubix"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/snake"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/suprememc"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/rustcraft"]')).not.toBeNull();
  });

  it('should give every card its portfolio artwork mark', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const marks = Array.from(compiled.querySelectorAll<HTMLImageElement>('a[href] img'));

    expect(marks.map((mark) => mark.getAttribute('src'))).toEqual([
      'assets/images/alkalab.svg',
      'assets/images/rubix.svg',
      'assets/images/rustcraft.svg',
      'assets/images/snake.svg',
      'assets/images/suprememc.png',
    ]);
    // The mark is decorative: the card's own text already names the game.
    marks.forEach((mark) => expect(mark.getAttribute('alt')).toBe(''));
  });

  it('should list the games alphabetically', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const routes = Array.from(compiled.querySelectorAll('a[href]')).map((link) =>
      link.getAttribute('href'),
    );
    expect(routes).toEqual(['/alkalab', '/rubix', '/rustcraft', '/snake', '/suprememc']);
  });
});
