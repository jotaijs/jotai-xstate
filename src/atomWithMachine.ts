import type { Getter } from 'jotai/vanilla'
import { atom } from 'jotai/vanilla'
import type { Actor, ActorOptions, AnyStateMachine, StateFrom } from 'xstate'
import { createActor } from 'xstate'

export const RESTART = Symbol()

export function atomWithMachine<TMachine extends AnyStateMachine>(
  getMachine: TMachine | ((get: Getter) => TMachine),
  options?: ActorOptions<TMachine>
) {
  const cachedMachineAtom = atom<{
    machine: TMachine
    actor: Actor<TMachine>
  } | null>(null)

  const cachedStateAtom = atom<{
    snapshot: StateFrom<TMachine>
  } | null>(null)

  const machineAtom = atom(
    (get) => {
      const cachedMachine = get(cachedMachineAtom)

      // machine only initialize once never change !!!
      if (cachedMachine) return cachedMachine

      const machine = isGetter(getMachine) ? getMachine(get) : getMachine
      const actor = createActor(machine, options)

      return { machine, actor }
    },
    (get, set) => {
      const { machine, actor } = get(machineAtom)
      set(cachedMachineAtom, { machine, actor })
      set(cachedStateAtom, { snapshot: actor.getSnapshot() })
      actor.subscribe((snapshot) => {
        set(cachedStateAtom, { snapshot })
      })
      actor.start()
    }
  )

  // atom only onMount once never change !!!
  machineAtom.onMount = (set) => void set()

  return atom(
    (get) =>
      get(cachedStateAtom)?.snapshot ?? get(machineAtom).actor.getSnapshot(),
    (
      get,
      set,
      event: Parameters<Actor<TMachine>['send']>[0] | typeof RESTART
    ) => {
      const { actor } = get(machineAtom)
      if (event === RESTART) {
        actor.stop()
        set(cachedMachineAtom, null)
        set(machineAtom)
      } else {
        actor.send(event)
      }
    }
  )
}

const isGetter = <T>(v: T | ((get: Getter) => T)): v is (get: Getter) => T =>
  typeof v === 'function'
