import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

const REPO = 'https://github.com/pattygcoding/Arcade-PG-Website';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the arcade navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).not.toBeNull();
    expect(compiled.querySelector('a[href="/alkalab"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/snake"]')).not.toBeNull();
  });

  it('should open the phone menu and close it again', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector<HTMLButtonElement>('button[aria-controls="site-menu"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('#site-menu')).toBeNull();

    trigger?.click();
    await fixture.whenStable();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelectorAll('#site-menu a[href]')).toHaveLength(4);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('#site-menu')).toBeNull();
  });

  it('should link the site header to its GitHub repository', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const repo = compiled.querySelector(`a[href="${REPO}"]`);
    expect(repo).not.toBeNull();
    expect(repo?.getAttribute('target')).toBe('_blank');
    expect(repo?.getAttribute('rel')).toBe('noopener');
  });
});

