/* eslint @typescript-eslint/no-explicit-any: off */

import type { Getter, WritableAtom } from 'jotai/vanilla';
import { atom } from 'jotai/vanilla';
import {
    createActor,
    type Actor,
    type AnyActorLogic
} from 'xstate';
import { isGetter } from './utils.js';

export const RESTART = Symbol();

// export interface ActorAtomOptions<
//   TContext extends ActorContext,
//   TEvent extends EventObject,
//   > {
//   /**
//    * If provided, will be merged with actor's `context`.
//    */
//   context?: Partial<TContext>;
//   /**
//    * The state to rehydrate the actor to. The actor will
//    * start at this state instead of its `initialState`.
//    */
//   state?: StateConfig<TContext, TEvent>;
// }

type Options<TLogic extends AnyActorLogic> = Parameters<typeof createActor<TLogic>>[1];

type MaybeParam<T> = T extends (v: infer V) => unknown ? V : never;
export function atomWithActor<TLogic extends AnyActorLogic, TActor extends Actor<TLogic> = Actor<TLogic>, TOptions = Options<TLogic>>(
  getLogic: TLogic | ((get: Getter) => TLogic),
  getOptions?: TOptions | ((get: Getter) => TOptions),
): WritableAtom<
TActor,
[MaybeParam<TActor['send']> | typeof RESTART],
void
> {
  const cachedActorAtom = atom<TActor| null>(null);
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
      const options = isGetter(getOptions) ? getOptions(safeGet) : getOptions;
      initializing = false;


      const actor = createActor(logic, options as any);
      return actor as TActor
    },
    (get, set) => {
      set(cachedActorAtom, get(actorAtom));
    },
  );

  actorAtom.onMount = (commit) => {
    commit();
  };

  return actorAtom
}
