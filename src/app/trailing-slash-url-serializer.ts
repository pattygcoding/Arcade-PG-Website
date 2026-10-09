import { Injectable } from '@angular/core';
import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/**
 * Tolerates a trailing slash on any URL.
 *
 * Static hosts commonly redirect `/alkalab` to `/alkalab/` when they serve
 * `alkalab/index.html`, and Angular's default serializer treats that trailing
 * slash as an extra empty segment, which matches no route and drops the visitor
 * on the wildcard.  Trimming it keeps every shared deep link working.
 */
@Injectable()
export class TrailingSlashUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    return super.parse(normalizeTrailingSlash(url));
  }
}

/** `alkalab/` -> `alkalab`, `/alkalab/?x=1` -> `/alkalab?x=1`, `/` stays `/`. */
function normalizeTrailingSlash(url: string): string {
  const match = /^([^?#]*)([\s\S]*)$/.exec(url);
  const path = (match?.[1] ?? '').replace(/\/+$/, '');
  const rest = match?.[2] ?? '';
  return `${path || '/'}${rest}`;
}
