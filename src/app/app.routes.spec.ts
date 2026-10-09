import { TestBed } from '@angular/core/testing';
import { Router, UrlSerializer, provideRouter } from '@angular/router';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { TrailingSlashUrlSerializer } from './trailing-slash-url-serializer';

// Every project URL is shared as a deep link, so the router must resolve the
// canonical form (/alkalab) and the trailing-slash form a static host redirects to
// when it serves <route>/index.html.
describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
      ],
    });
  });

  it.each([
    ['/', '/'],
    ['/alkalab', '/alkalab'],
    ['/snake', '/snake'],
    ['/suprememc', '/suprememc'],
    ['/rustcraft', '/rustcraft'],
  ])('should resolve %s', async (url, expected) => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    expect(router.url).toBe(expected);
  });

  it.each(['/alkalab/', '/snake/', '/suprememc/', '/rustcraft/'])(
    'should resolve the trailing-slash deep link %s',
    async (url) => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl(url);
      expect(router.url).not.toBe('/');
      expect(router.url).toContain(url.replace(/\//g, ''));
    },
  );

  it('should fall back to the home page for unknown paths', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/definitely-not-a-page');
    expect(router.url).toBe('/');
  });
});

describe('app config', () => {
  it('should register the trailing-slash tolerant serializer', () => {
    const entries = appConfig.providers as { provide?: unknown; useClass?: unknown }[];
    const provider = entries.find((entry) => entry && entry.provide === UrlSerializer);
    expect(provider?.useClass).toBe(TrailingSlashUrlSerializer);
  });
});

