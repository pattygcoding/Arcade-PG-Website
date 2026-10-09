import { TestBed } from '@angular/core/testing';
import { Snake } from './snake';

describe('Snake', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Snake] }).compileComponents();
  });

  it('should render the canvas and the touch controls', async () => {
    const fixture = TestBed.createComponent(Snake);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('canvas')).not.toBeNull();
    expect(compiled.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(compiled.querySelector('[aria-label="Move up"]')).not.toBeNull();
  });

  it('keyboard-activated direction buttons send input without moving focus', async () => {
    const fixture = TestBed.createComponent(Snake);
    await fixture.whenStable();

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const button = fixture.nativeElement.querySelector(
      '[aria-label="Move up"]',
    ) as HTMLButtonElement;

    const events: string[] = [];
    canvas.addEventListener('keydown', (event) =>
      events.push(`${event.type}:${(event as KeyboardEvent).key}`),
    );
    canvas.addEventListener('keyup', (event) =>
      events.push(`${event.type}:${(event as KeyboardEvent).key}`),
    );

    button.focus();
    button.click();

    expect(events).toEqual(['keydown:ArrowUp', 'keyup:ArrowUp']);
    expect(document.activeElement).toBe(button);
  });
});
