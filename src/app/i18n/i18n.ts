import en from './en.json';

/**
 * The single locale bundle.  Every user-facing string lives in `en.json`; import
 * this (rather than the JSON directly) so components share one typed shape.
 */
export const strings = en;

export type Strings = typeof en;
