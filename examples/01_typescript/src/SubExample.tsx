import React from 'react'
import { useAtom } from 'jotai/react'
import { atomWithActor, atomWithActorSubscription } from 'jotai-xstate'
import { createMachine } from 'xstate'

const childMachine = createMachine({
  id: 'ChildMachine',
  initial: 'IDLE',
  states: {
    IDLE: {
      on: {
        'child.start': [
          {
            target: 'RUNNING',
          },
        ],
      },
    },
    RUNNING: {
      entry: [
        ({ context, event }) => console.log('CHILD RUNNING', context, event),
      ],
    },
  },
  types: {} as {
    events: { type: 'child.start' }
  },
})

const appMachine = createMachine({
  id: 'AppMachine',
  initial: 'IDLE',
  invoke: {
    id: 'childMachine',
    systemId: 'childMachine',
    src: childMachine,
  },
  states: {
    IDLE: {
      on: {
        'app.start': [
          {
            target: 'RUNNING',
            guard: () => typeof window !== 'undefined',
          },
          {
            target: 'SERVER',
            guard: () => typeof window === 'undefined',
          },
        ],
      },
    },
    RUNNING: {
      entry: [
        ({ context, event }) =>
          console.log('RUNNING ON CLIENT', context, event),
      ],
    },
    SERVER: {
      entry: [
        ({ context, event }) =>
          console.log('RUNNING ON SERVER', context, event),
      ],
    },
  },
})

const appMachineAtom = atomWithActor(appMachine)

const childMachineAtom = atomWithActorSubscription<typeof childMachine>((get) =>
  get(appMachineAtom).actorRef.system.get('childMachine')
)

export default function Page() {
  const [{ state }, send] = useAtom(appMachineAtom)
  const [{ state: childState }, childSend] = useAtom(childMachineAtom)

  return (
    <div>
      <h1>App State: {state.value.toString()}</h1>
      <h2>Child State: {childState.value.toString()}</h2>
      <button onClick={() => send({ type: 'app.start' })}>Start App</button>
      <button onClick={() => childSend({ type: 'child.start' })}>
        Start Child
      </button>
    </div>
  )
}
