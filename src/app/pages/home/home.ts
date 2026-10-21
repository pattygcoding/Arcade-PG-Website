import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { strings } from '../../i18n/i18n';

interface GameCard {
  route: string;
  /**
   * The mark the PG-Website portfolio uses for this project, copied here so both
   * sites show a game the same way.  SupremeMC's is a PNG there, and so is this.
   */
  mark: string;
  name: string;
  kind: string;
  summary: string;
  stack: string;
}

// The selection screen's cards.  Copy comes from en.json; only the route and the
// mark (which are not language) live here.
const GAME_CARDS: readonly GameCard[] = [
  {
    route: '/alkalab',
    mark: 'assets/images/alkalab.svg',
    name: strings.games.alkalab.name,
    kind: strings.games.alkalab.kind,
    summary: strings.games.alkalab.summary,
    stack: strings.games.alkalab.stack,
  },
  {
    route: '/chess',
    mark: 'assets/images/chess.svg',
    name: strings.games.chess.name,
    kind: strings.games.chess.kind,
    summary: strings.games.chess.summary,
    stack: strings.games.chess.stack,
  },
  {
    route: '/rubik',
    mark: 'assets/images/rubik.svg',
    name: strings.games.rubik.name,
    kind: strings.games.rubik.kind,
    summary: strings.games.rubik.summary,
    stack: strings.games.rubik.stack,
  },
  {
    route: '/rustcraft',
    mark: 'assets/images/rustcraft.svg',
    name: strings.games.rustcraft.name,
    kind: strings.games.rustcraft.kind,
    summary: strings.games.rustcraft.summary,
    stack: strings.games.rustcraft.stack,
  },
  {
    route: '/snake',
    mark: 'assets/images/snake.svg',
    name: strings.games.snake.name,
    kind: strings.games.snake.kind,
    summary: strings.games.snake.summary,
    stack: strings.games.snake.stack,
  },
  {
    route: '/suprememc',
    mark: 'assets/images/suprememc.png',
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

