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
    path: 'chess',
    loadComponent: () => import('./pages/chess/chess').then((m) => m.Chess),
    title: `${strings.games.chess.name} - ${appName}`,
  },
  {
    path: 'rubik',
    loadComponent: () => import('./pages/rubik/rubik').then((m) => m.Rubik),
    title: `${strings.games.rubik.name} - ${appName}`,
  },
  // The page shipped briefly with the older /rubix spelling, so that legacy
  // link keeps working; GitHub Pages serves 404.html for the unknown path,
  // which boots the app and lands here.
  { path: 'rubix', redirectTo: 'rubik', pathMatch: 'full' },
  {
    path: 'rustcraft',
    loadComponent: () => import('./pages/rustcraft/rustcraft').then((m) => m.Rustcraft),
    title: `${strings.games.rustcraft.name} - ${appName}`,
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


