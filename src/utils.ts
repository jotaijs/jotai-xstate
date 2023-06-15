import { type Getter } from 'jotai'

export const isGetter = <T>(
  v: T | ((get: Getter) => T)
): v is (get: Getter) => T => typeof v === 'function'

export function defaultCompare<T>(a: T, b: T) {
  return a === b
}
