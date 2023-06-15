import { type Getter, atom } from 'jotai'
import {
  type AnyStateMachine,
  type EventFromLogic,
  type Interpreter,
  type SnapshotFrom,
} from 'xstate'
import { isGetter } from './utils'

export function atomWithActorSubscription<
  TMachine extends AnyStateMachine = AnyStateMachine,
  TActorRef extends Interpreter<
    TMachine,
    EventFromLogic<AnyStateMachine>
  > = Interpreter<TMachine, EventFromLogic<TMachine>>,
  TSend extends EventFromLogic<TMachine> = EventFromLogic<TMachine>
>(getActor: TActorRef | ((get: Getter) => TActorRef)) {
  const actorRefAtom = atom<null | TActorRef>(null)

  const cachedMachineStateAtom = atom<SnapshotFrom<TActorRef> | null>(null)
  if (process.env['NODE_ENV'] !== 'production') {
    cachedMachineStateAtom.debugPrivate = true
  }

  const actorOperatorAtom = atom(
    (get) => {
      const interpretedMachine = get(actorRefAtom)
      if (interpretedMachine) return interpretedMachine

      let initializing = true
      const safeGet: typeof get = (...args) => {
        if (initializing) {
          return get(...args)
        }
        throw new Error('get not allowed after initialization')
      }
      const actor = isGetter(getActor) ? getActor(safeGet) : getActor
      initializing = false
      return actor
    },
    (get, set) => {
      if (get(actorRefAtom) === null) return
      set(actorRefAtom, get(actorOperatorAtom))
    }
  )
  actorOperatorAtom.onMount = (commit) => {
    commit()
  }

  const actorOrchestratorAtom = atom(
    (get) => get(actorOperatorAtom),
    (get, set, registerCleanup: (cleanup: () => void) => void) => {
      const actor = get(actorOperatorAtom)
      const subscription = actor.subscribe((nextState) => {
        set(cachedMachineStateAtom, nextState)
      })
      registerCleanup(() => {
        subscription.unsubscribe()
      })
    }
  )
  actorOrchestratorAtom.onMount = (initialize) => {
    let unSubscribe: (() => void) | undefined | false

    initialize((cleanup) => {
      if (unSubscribe === false) {
        cleanup()
      } else {
        unSubscribe = cleanup
      }
    })

    return () => {
      if (unSubscribe) {
        unSubscribe()
      }
      unSubscribe = false
    }
  }

  const actorStateAtom = atom(
    (get) => {
      const state =
        get(cachedMachineStateAtom) ??
        (get(actorOrchestratorAtom).getSnapshot() as SnapshotFrom<TMachine>)
      const actorRef = get(actorOrchestratorAtom)
      return { state, actorRef }
    },
    (get, set, action: TSend) => {
      const actor = get(actorOrchestratorAtom)
      actor.send(action)
    }
  )

  return actorStateAtom
}
