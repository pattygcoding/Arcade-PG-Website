import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { UrlSerializer, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { TrailingSlashUrlSerializer } from './trailing-slash-url-serializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Registered after provideRouter so this override of the default wins.
    { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
  ],
};

