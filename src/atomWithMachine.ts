/* eslint @typescript-eslint/no-explicit-any: off */

import type { Getter, WritableAtom } from 'jotai/vanilla';
import { atom } from 'jotai/vanilla';
import {
  type Actor,
  type ActorOptions,
  type AnyStateMachine,
  type Compute,
  type ContextFrom,
  type EventFrom,
  type EventObject,
  type InternalMachineImplementations,
  type MachineContext,
  type StateConfig,
  type StateFrom,
  type __ResolvedTypesMetaFrom,
} from 'xstate';
import { atomWithActor } from './atomWithActor.js';
import { atomWithActorSnapshot } from './atomWithActorSnapshot.js';
import { RESTART, isGetter } from './utils.js';

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
  const machineLogicAtom = atom((get) => {
    let initializing = true;
    const safeGet: typeof get = (...args) => {
      if (initializing) {
        return get(...args);
      }
      throw new Error('get not allowed after initialization');
    };
    const machine = isGetter(getMachine) ? getMachine(safeGet) : getMachine;
    const options = isGetter(getOptions)
      ? getOptions(safeGet)
      : getOptions ?? {};
    initializing = false;

    const machineConfig = {
      guards: options.guards ?? {},
      actions: options.actions ?? {},
      actors: options.actors ?? {},
      delays: options.delays ?? {},
      context: options.context ?? {},
    };
    const machineWithConfig = machine.provide({ ...machineConfig });
    return machineWithConfig as TMachine;
  });

  const machineActorAtom = atomWithActor(
    (get) => get(machineLogicAtom),
    // The types are correct but the parsing + current TS rules cause this line to error because of exactOptionalPropertyTypes and i'm not sure how to fix
    getOptions as any,
  );

  const machineStateAtom = atomWithActorSnapshot((get) =>
    get(machineActorAtom),
  );

  const machineStateWithActorAtom = atom(
    (get) => {
      return get(machineStateAtom);
    },
    (
      _,
      set,
      event: Parameters<Actor<TMachine>['send']>[0] | typeof RESTART,
    ) => {
      set(machineActorAtom, event);
      if (event === RESTART) {
        set(machineStateAtom);
      }
    },
  );

  return machineStateWithActorAtom;
}
