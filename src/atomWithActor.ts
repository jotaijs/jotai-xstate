/* eslint @typescript-eslint/no-explicit-any: off */

import type { Getter, WritableAtom } from 'jotai/vanilla';
import { atom } from 'jotai/vanilla';
import {
  createActor,
  type Actor,
  type ActorOptions,
  type AnyActorLogic,
  type ConditionalRequired,
  type InputFrom,
  type IsNotNever,
} from 'xstate';
import { RESTART, isGetter, type Gettable } from './utils.js';

type RequiredOptions<TLogic extends AnyActorLogic> =
  undefined extends InputFrom<TLogic> ? never : 'input';

type MaybeParam<T> = T extends (v: infer V) => unknown ? V : never;
type ActorAtomOptions = { autoStart?: boolean };

export function atomWithActor<
  TLogic extends AnyActorLogic,
  TActor extends Actor<TLogic> = Actor<TLogic>,
>(
  getLogic: TLogic | ((get: Getter) => TLogic),
  // Needed to match the types and error correctly when logic has input
  ...[getOptions]: ConditionalRequired<
    [
      getOptions?: Gettable<
        ActorAtomOptions &
          ActorOptions<TLogic> & {
            [K in RequiredOptions<TLogic>]: unknown;
          }
      >,
    ],
    IsNotNever<RequiredOptions<TLogic>>
  >
): WritableAtom<TActor, [MaybeParam<TActor['send']> | typeof RESTART], void> {
  const cachedActorAtom = atom<TActor | null>(null);
  if (process.env.NODE_ENV !== 'production') {
    cachedActorAtom.debugPrivate = true;
  }

  const actorAtom = atom(
    (get) => {
      const cachedActor = get(cachedActorAtom);
      if (cachedActor) {
        return cachedActor;
      }
      let initializing = true;
      const safeGet: typeof get = (...args) => {
        if (initializing) {
          return get(...args);
        }
        throw new Error('get not allowed after initialization');
      };
      const logic = isGetter(getLogic) ? getLogic(safeGet) : getLogic;
      const innerOptions = isGetter(getOptions)
        ? getOptions(safeGet)
        : getOptions;
      const { autoStart = true, ...options } = innerOptions ?? {};
      initializing = false;
      // The types are correct but the parsing + current TS rules cause this line to error because of exactOptionalPropertyTypes and i'm not sure how to fix
      const actor = createActor(logic, options as any);
      if (autoStart) actor.start();
      return actor as TActor;
    },
    (get, set) => {
      set(cachedActorAtom, get(actorAtom));
    },
  );

  actorAtom.onMount = (commit) => {
    commit();
  };

  const resetableActorAtom = atom<
    TActor,
    [Parameters<TActor['send']>[0] | typeof RESTART],
    void
  >(
    (get) => get(actorAtom),
    (get, set, event) => {
      const actor = get(actorAtom);
      if (event === RESTART) {
        actor.stop();
        set(cachedActorAtom, null);
        set(actorAtom);
      } else {
        actor.send(event);
      }
    },
  );

  return resetableActorAtom;
}
