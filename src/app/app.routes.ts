import { Routes } from '@angular/router';
import { strings } from './i18n/i18n';

const appName = strings.meta.appName;

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    title: appName,
  },
  {
    path: 'alkalab',
    loadComponent: () => import('./pages/alkalab/alkalab').then((m) => m.Alkalab),
    title: `${strings.games.alkalab.name} - ${appName}`,
  },
  {
    path: 'snake',
    loadComponent: () => import('./pages/snake/snake').then((m) => m.Snake),
    title: `${strings.games.snake.name} - ${appName}`,
  },
  {
    path: 'suprememc',
    loadComponent: () => import('./pages/suprememc/suprememc').then((m) => m.SupremeMc),
    title: `${strings.games.suprememc.name} - ${appName}`,
  },
  { path: '**', redirectTo: '' },
];


