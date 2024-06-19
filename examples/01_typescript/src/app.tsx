/* eslint jsx-a11y/no-autofocus: off */

import { Provider, useAtom } from 'jotai/react';
import { atom } from 'jotai/vanilla';
// TODO: Revert back to regular import
import { RESTART, atomWithMachine } from '../../../src/atomWithMachine';
import { assign, setup } from 'xstate';

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

const Toggle = () => {
  const [state, send] = useAtom(editableMachineAtom);

  return (
    <div>
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

const App = () => (
  <Provider>
    <Toggle />
  </Provider>
);

export default App;
