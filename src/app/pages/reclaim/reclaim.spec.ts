import { TestBed } from '@angular/core/testing';
import { Reclaim } from './reclaim';

describe('Reclaim', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Reclaim] }).compileComponents();
  });

  it('should embed the game frame with the touch controls', async () => {
    const fixture = TestBed.createComponent(Reclaim);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('iframe')).not.toBeNull();
    expect(compiled.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(compiled.querySelector('[aria-label="Jump"]')).not.toBeNull();
    expect(compiled.querySelector('[aria-label="Move left"]')).not.toBeNull();
    expect(compiled.querySelector('[aria-label="Move right"]')).not.toBeNull();
  });
});
