/* eslint jsx-a11y/no-autofocus: off */

import { Provider, useAtom } from 'jotai/react';
import { atom } from 'jotai/vanilla';
import {
  atomWithActor,
  atomWithActorSnapshot,
  atomWithMachine,
} from 'jotai-xstate';
import { useEffect } from 'react';
import { assign, fromPromise, setup } from 'xstate';
import { RESTART } from '../../../src/utils';

const createEditableMachine = (value: string) =>
  setup({
    types: {
      events: {} as
        | { type: 'dblclick' }
        | { type: 'cancel' }
        | { type: 'commit'; value: string },
      context: {} as { value: string },
    },
    actions: {
      commitValue: assign({
        value: ({ event }) => {
          if (event.type !== 'commit') throw new Error('Invalid transition');
          return event.value;
        },
      }),
    },
  }).createMachine({
    id: 'editable',
    initial: 'reading',
    context: {
      value,
    },
    states: {
      reading: {
        on: {
          dblclick: 'editing',
        },
      },
      editing: {
        on: {
          cancel: 'reading',
          commit: {
            target: 'reading',
            actions: { type: 'commitValue' },
          },
        },
      },
    },
  });

const defaultTextAtom = atom('edit me');

const editableMachineAtom = atomWithMachine((get) =>
  createEditableMachine(get(defaultTextAtom)),
);

const Divider = () => {
  return (
    <div
      style={{
        height: 2,
        background: 'black',
        marginTop: 10,
        marginBottom: 10,
      }}
    ></div>
  );
};

const Toggle = () => {
  const [state, send] = useAtom(editableMachineAtom);
  return (
    <div>
      <h2>Machine Atom</h2>
      {state.matches('reading') && (
        <strong onDoubleClick={() => send({ type: 'dblclick' })}>
          {state.context.value}
        </strong>
      )}
      {state.matches('editing') && (
        <input
          autoFocus
          defaultValue={state.context.value}
          onBlur={(e) => send({ type: 'commit', value: e.currentTarget.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              send({ type: 'commit', value: e.currentTarget.value });
            }
            if (e.key === 'Escape') {
              send({ type: 'cancel' });
            }
          }}
        />
      )}
      <br />
      <br />
      <div>
        Double-click to edit. Blur the input or press <code>enter</code> to
        commit. Press <code>esc</code> to cancel.
      </div>
      <button onClick={() => send(RESTART)}>RESTART</button>
    </div>
  );
};

const promiseLogicAtom = atom(
  fromPromise<string, { duration: number }, { type: 'elapsed'; value: number }>(
    async ({ emit, input }) => {
      const start = Date.now();
      let now = Date.now();
      do {
        await new Promise((res) => setTimeout(res, 200));
        emit({ type: 'elapsed', value: now - start });
        now = Date.now();
      } while (now - start < input.duration);
      return 'Promise finished';
    },
  ),
);

const durationAtom = atom(5000);

const promiseActorAtom = atomWithActor(
  (get) => get(promiseLogicAtom),
  (get) => {
    const duration = get(durationAtom);
    return { input: { duration } };
  },
);

const promiseSnapshotAtom = atomWithActorSnapshot((get) =>
  get(promiseActorAtom),
);

const elapsedAtom = atom(0);
const PromiseActor = () => {
  const [actor, send] = useAtom(promiseActorAtom);
  const [snapshot, clear] = useAtom(promiseSnapshotAtom);
  const [elapsed, setElapsed] = useAtom(elapsedAtom);
  const [input, setInput] = useAtom(durationAtom);

  useEffect(() => {
    const sub = actor.on('elapsed', (event) => setElapsed(event.value));
    return sub.unsubscribe;
  }, [actor, setElapsed]);

  return (
    <div>
      <h2>Promise actor atom</h2>
      <div>
        {snapshot.status === 'active' &&
          `Waiting on promise. Elapsed ${Math.floor(elapsed / 1000)} out of ${Math.floor(input / 1000)} seconds`}
        {snapshot.status === 'done' && snapshot.output}
      </div>
      <button
        onClick={() => {
          send(RESTART);
          clear();
        }}
        disabled={snapshot.status !== 'done'}
      >
        RESTART
      </button>
      <button
        onClick={() => {
          setInput(10000);
          send(RESTART);
          clear();
        }}
      >
        Wait 10 seconds
      </button>
    </div>
  );
};

const App = () => (
  <Provider>
    <Toggle />
    <Divider />
    <PromiseActor />
  </Provider>
);

export default App;
