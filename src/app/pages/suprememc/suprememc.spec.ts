import { TestBed } from '@angular/core/testing';
import { SupremeMc } from './suprememc';

const REPO = 'https://github.com/pattygcoding/SupremeMC-26.2-Mod';
const CURSEFORGE = 'https://www.curseforge.com/minecraft/mc-mods/suprememc';

describe('SupremeMc', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SupremeMc] }).compileComponents();
  });

  it('should render the showcase with stats, features and timeline', async () => {
    const fixture = TestBed.createComponent(SupremeMc);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toBe('SupremeMC');
    expect(compiled.querySelectorAll('.suprememc-feature')).toHaveLength(6);
    expect(compiled.querySelectorAll('.suprememc-feature__icon path')).toHaveLength(6);
    expect(compiled.querySelectorAll('.suprememc-stats > div')).toHaveLength(4);
    expect(compiled.querySelectorAll('.suprememc-timeline li').length).toBeGreaterThan(0);
  });

  it('should link to the repository and CurseForge safely', async () => {
    const fixture = TestBed.createComponent(SupremeMc);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const repoLinks = compiled.querySelectorAll(`a[href="${REPO}"]`);
    expect(repoLinks.length).toBeGreaterThan(0);
    repoLinks.forEach((link) => expect(link.getAttribute('rel')).toBe('noopener noreferrer'));

    const curseforge = compiled.querySelector('.suprememc-download');
    expect(curseforge?.getAttribute('href')).toBe(CURSEFORGE);
    expect(curseforge?.getAttribute('target')).toBe('_blank');
    expect(curseforge?.textContent).toContain('Download on CurseForge');
  });
});
