import { type Getter, atom } from 'jotai'
import {
  type ActorRefFrom,
  type AnyStateMachine,
  type EventFromLogic,
  type Interpreter,
  type SnapshotFrom,
} from 'xstate'
import { isGetter } from './utils'

export function atomWithActorSubscription<
  TMachine extends AnyStateMachine = AnyStateMachine,
  Parent extends ActorRefFrom<AnyStateMachine> = ActorRefFrom<AnyStateMachine>
>(
  systemId: string | ((get: Getter) => string),
  getMachine: Parent | ((get: Getter) => Parent)
) {
  const providedMachineAtom = atom<null | {
    machine: Parent
    actor: Interpreter<TMachine, EventFromLogic<TMachine>>
  }>(null)

  const cachedMachineStateAtom = atom<SnapshotFrom<TMachine> | null>(null)
  if (process.env['NODE_ENV'] !== 'production') {
    cachedMachineStateAtom.debugPrivate = true
  }

  const machineOperatorAtom = atom(
    (get) => {
      const interpretedMachine = get(providedMachineAtom)
      if (interpretedMachine) return interpretedMachine

      let initializing = true
      const safeGet: typeof get = (...args) => {
        if (initializing) {
          return get(...args)
        }
        throw new Error('get not allowed after initialization')
      }
      const id = isGetter(systemId) ? systemId(safeGet) : systemId
      const machine = isGetter(getMachine) ? getMachine(safeGet) : getMachine

      const foundActor = machine.system?.get(id)
      if (!foundActor) {
        throw new Error(`No actor found with id ${id}`)
      }

      initializing = false

      return {
        machine,
        actor: foundActor as Interpreter<TMachine, EventFromLogic<TMachine>>,
      }
    },
    (get, set) => {
      if (get(providedMachineAtom) === null) return
      set(providedMachineAtom, get(machineOperatorAtom))
    }
  )
  machineOperatorAtom.onMount = (commit) => {
    commit()
  }

  const actorOrchestratorAtom = atom(
    (get) => get(machineOperatorAtom).actor,
    (get, set, registerCleanup: (cleanup: () => void) => void) => {
      const { actor } = get(machineOperatorAtom)
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
    (get, set, action: EventFromLogic<TMachine>) => {
      const actor = get(actorOrchestratorAtom)
      actor.send(action as EventFromLogic<TMachine>)
    }
  )

  return actorStateAtom
}
