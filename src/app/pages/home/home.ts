import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { strings } from '../../i18n/i18n';

type GameIcon = 'flask' | 'gamepad' | 'blocks';

interface GameCard {
  route: string;
  name: string;
  kind: string;
  summary: string;
  stack: string;
  icon: GameIcon;
}

// The selection screen's cards.  Copy comes from en.json; only the route and the
// icon (which are not language) live here.
const GAME_CARDS: readonly GameCard[] = [
  {
    route: '/alkalab',
    icon: 'flask',
    name: strings.games.alkalab.name,
    kind: strings.games.alkalab.kind,
    summary: strings.games.alkalab.summary,
    stack: strings.games.alkalab.stack,
  },
  {
    route: '/snake',
    icon: 'gamepad',
    name: strings.games.snake.name,
    kind: strings.games.snake.kind,
    summary: strings.games.snake.summary,
    stack: strings.games.snake.stack,
  },
  {
    route: '/suprememc',
    icon: 'blocks',
    name: strings.games.suprememc.name,
    kind: strings.games.suprememc.kind,
    summary: strings.games.suprememc.summary,
    stack: strings.games.suprememc.stack,
  },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly t = strings;
  protected readonly games = GAME_CARDS;
}

