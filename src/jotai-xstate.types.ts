import type {
  AnyActorLogic,
  AnyActorRef,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineImplementations,
  InterpreterOptions,
  MachineContext,
  MarkAllImplementationsAsProvided,
  StateConfig,
  StateMachine,
} from 'xstate';

export interface MachineAtomOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
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

export type Options<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? InterpreterOptions<AnyActorLogic> &
        MachineAtomOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >
    : InterpreterOptions<AnyActorLogic> &
        MachineAtomOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta']
        >;

export type MaybeParam<T> = T extends (v: infer V) => unknown ? V : never;

export type SendEvent = Parameters<AnyActorRef['send']>[0];

// Taken from https://github.com/statelyai/xstate/blob/xstate%405.0.0-beta.13/packages/xstate-react/src/createActorContext.ts
type ToMachinesWithProvidedImplementations<TMachine extends AnyStateMachine> =
  TMachine extends StateMachine<
    infer TContext,
    infer TEvent,
    infer TAction,
    infer TActorMap,
    infer TResolvedTypesMeta
  >
    ? StateMachine<
        TContext,
        TEvent,
        TAction,
        TActorMap,
        AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
          ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
          : TResolvedTypesMeta
      >
    : never;
