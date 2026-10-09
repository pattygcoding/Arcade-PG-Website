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
    expect(compiled.querySelector('a[href="/snake"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/suprememc"]')).not.toBeNull();
  });
});
