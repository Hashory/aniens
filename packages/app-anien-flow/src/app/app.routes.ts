import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('#app/features/main/aniens-main.component').then((m) => m.AniensMainComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/404/not-found.component').then((m) => m.NotFoundComponent),
  },
];
