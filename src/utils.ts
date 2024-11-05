import type { Getter } from 'jotai/vanilla';

export const isGetter = <T>(
  v: T | ((get: Getter) => T),
): v is (get: Getter) => T => typeof v === 'function';

export const RESTART = Symbol();

export type Gettable<T> = T | ((get: Getter) => T);
