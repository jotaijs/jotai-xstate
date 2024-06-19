/* eslint @typescript-eslint/no-explicit-any: off */

import type { Getter, WritableAtom } from 'jotai/vanilla';
import { atom } from 'jotai/vanilla';
import {
  createActor,
  type Actor,
  type ActorOptions,
  type AnyActor,
  type AnyStateMachine,
  type Compute,
  type ContextFrom,
  type EventFrom,
  type EventObject,
  type InternalMachineImplementations,
  type MachineContext,
  type StateConfig,
  type StateFrom,
  type Subscription,
  type __ResolvedTypesMetaFrom,
} from 'xstate';

export const RESTART = Symbol();

export interface MachineAtomOptions<
  TContext extends MachineContext,
  TEvent extends EventObject,
> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

type Options<TMachine extends AnyStateMachine> = Compute<
  MachineAtomOptions<ContextFrom<TMachine>, EventFrom<TMachine>> &
    InternalMachineImplementations<
      ContextFrom<TMachine>,
      __ResolvedTypesMetaFrom<TMachine>
    > &
    ActorOptions<TMachine>
>;

type MaybeParam<T> = T extends (v: infer V) => unknown ? V : never;
export function atomWithMachine<TMachine extends AnyStateMachine>(
  getMachine: TMachine | ((get: Getter) => TMachine),
  getOptions?: Options<TMachine> | ((get: Getter) => Options<TMachine>),
): WritableAtom<
  StateFrom<TMachine>,
  [MaybeParam<Actor<TMachine>['send']> | typeof RESTART],
  void
> {
  const cachedMachineAtom = atom<{
    machine: AnyStateMachine;
    actor: AnyActor;
  } | null>(null);
  if (process.env.NODE_ENV !== 'production') {
    cachedMachineAtom.debugPrivate = true;
  }

  const machineAtom = atom(
    (get) => {
      const cachedMachine = get(cachedMachineAtom);
      if (cachedMachine) {
        return cachedMachine;
      }
      let initializing = true;
      const safeGet: typeof get = (...args) => {
        if (initializing) {
          return get(...args);
        }
        throw new Error('get not allowed after initialization');
      };
      const machine = isGetter(getMachine) ? getMachine(safeGet) : getMachine;
      const options = isGetter(getOptions) ? getOptions(safeGet) : getOptions;
      initializing = false;
      const { guards, actions, actors, delays, context, ...actorOptions } =
        options || {};

      const machineConfig = {
        guards: guards ?? {},
        actions: actions ?? {},
        actors: actors ?? {},
        delays: delays ?? {},
        context: context ?? {},
      };

      const machineWithConfig = machine.provide({ ...machineConfig });
      const actor = createActor(machineWithConfig, actorOptions);
      return { machine: machineWithConfig, actor };
    },
    (get, set) => {
      set(cachedMachineAtom, get(machineAtom));
      set(subscriptionAtom);
    },
  );

  machineAtom.onMount = (commit) => {
    commit();
  };

  const cachedMachineStateAtom = atom<StateFrom<TMachine> | null>(null);
  if (process.env.NODE_ENV !== 'production') {
    cachedMachineStateAtom.debugPrivate = true;
  }

  const cachedSubscriptionAtom = atom<Subscription | null>(null);
  const subscriptionAtom = atom(
    (get) => {
      get(machineAtom);
      const cachedSub = get(cachedSubscriptionAtom);
      if (!cachedSub) {
        return { unsubscribe() {} };
      }
      return cachedSub;
    },
    (get, set) => {
      const { actor } = get(machineAtom);
      const sub = actor.subscribe((nextState: StateFrom<TMachine>) => {
        set(cachedMachineStateAtom, nextState);
      });
      set(cachedSubscriptionAtom, sub);
    },
  );

  const machineStateAtom = atom(
    (get) => {
      get(subscriptionAtom);
      return (
        get(cachedMachineStateAtom) ??
        (get(machineAtom).actor.getSnapshot() as StateFrom<TMachine>)
      );
    },
    (get, set, registerCleanup: (cleanup: () => void) => void) => {
      const { actor } = get(machineAtom);
      actor.start();
      registerCleanup(() => {
        const sub = get(subscriptionAtom);
        const { actor } = get(machineAtom);
        actor.stop();
        sub.unsubscribe();
        set(cachedSubscriptionAtom, null);
        set(cachedMachineStateAtom, null);
        set(cachedMachineAtom, null);
      });
    },
  );

  machineStateAtom.onMount = (initialize) => {
    let unsub: (() => void) | undefined | false;

    initialize((cleanup) => {
      if (unsub === false) {
        cleanup();
      } else {
        unsub = cleanup;
      }
    });

    return () => {
      if (unsub) {
        unsub();
      }
      unsub = false;
    };
  };

  if (process.env.NODE_ENV !== 'production') {
    machineStateAtom.debugPrivate = true;
  }

  if (process.env.NODE_ENV !== 'production') {
    machineStateAtom.debugPrivate = true;
  }

  const machineStateWithActorAtom = atom(
    (get) => {
      return get(machineStateAtom);
    },
    (get, set, event: Parameters<AnyActor['send']>[0] | typeof RESTART) => {
      const { actor } = get(machineAtom);
      if (event === RESTART) {
        actor.stop();
        set(cachedSubscriptionAtom, null);
        set(cachedMachineStateAtom, null);
        set(cachedMachineAtom, null);
        set(machineAtom);
        const { actor: newActor } = get(machineAtom);
        newActor.start();
      } else {
        actor.send(event);
      }
    },
  );

  return machineStateWithActorAtom;
}

const isGetter = <T>(v: T | ((get: Getter) => T)): v is (get: Getter) => T =>
  typeof v === 'function';
