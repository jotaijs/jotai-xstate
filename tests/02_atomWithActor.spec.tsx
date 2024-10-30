import { cleanup, render } from '@testing-library/react';
import { Provider, atom, createStore } from 'jotai';
import { atomWithActor, atomWithActorSnapshot } from 'jotai-xstate';
import { useAtom } from 'jotai/react';
import { describe } from 'node:test';
import { StrictMode, useEffect } from 'react';
import { afterEach, expect, it } from 'vitest';
import { fromPromise } from 'xstate';

afterEach(cleanup);

type PromiseLogicOutput = number;
type PromiseLogicInput = { duration: number };
type PromiseLogicEvents =
  | { type: 'elapsed'; value: number }
  | { type: 'completed' };

describe('Timeout promise actor', async () => {
  // Promise that awaits a duration specifiecied by its input
  // And emits "elapsed" events evenry 50ms
  const makePromiseLogic = () =>
    fromPromise<PromiseLogicOutput, PromiseLogicInput, PromiseLogicEvents>(
      async ({ emit, input }) => {
        const start = Date.now();
        let now = Date.now();
        do {
          await new Promise((res) => setTimeout(res, 50));
          emit({ type: 'elapsed', value: now - start });
          now = Date.now();
        } while (now - start < input.duration);
        emit({ type: 'elapsed', value: now - start });
        emit({ type: 'completed' });
        return now - start;
      },
    );

  const durationAtom = atom(500);

  it('Correctly checks actor snapshot for completion', async () => {
    const promiseActorAtom = atomWithActor(makePromiseLogic(), (get) => {
      const duration = get(durationAtom);
      return { input: { duration } };
    });
    const promiseSnapshotAtom = atomWithActorSnapshot((get) =>
      get(promiseActorAtom),
    );

    const TestComponent = () => {
      const [snapshot] = useAtom(promiseSnapshotAtom);

      return (
        <div>
          {snapshot.status === 'active' && `waiting`}
          {snapshot.status === 'done' && `done`}
        </div>
      );
    };

    const store = createStore();
    const before = Date.now();
    const { findByText } = render(
      <StrictMode>
        <Provider store={store}>
          <TestComponent />
        </Provider>
      </StrictMode>,
    );

    await findByText('waiting');
    await findByText('done');

    const after = Date.now();
    const diff = after - before;
    expect(diff).toBeGreaterThanOrEqual(500);
  });

  it('Attaches a listener to the actor and handles its results', async () => {
    const promiseActorAtom = atomWithActor(makePromiseLogic(), (get) => {
      const duration = get(durationAtom);
      return { input: { duration } };
    });
    const promiseSnapshotAtom = atomWithActorSnapshot((get) =>
      get(promiseActorAtom),
    );

    const elapsedAtom = atom(0);
    const roundedElapsed = atom((get) => {
      const elapsed = get(elapsedAtom);
      return Math.floor(elapsed / 100) * 100;
    });
    const TestComponent = () => {
      const [actorRef] = useAtom(promiseActorAtom);
      const [snapshot] = useAtom(promiseSnapshotAtom);
      const [_, setElapsed] = useAtom(elapsedAtom);

      useEffect(() => {
        const elapsedSub = actorRef.on('elapsed', (event) => {
          setElapsed(event.value);
        });
        return () => {
          elapsedSub.unsubscribe();
        };
      }, [actorRef, setElapsed]);

      return (
        <div>
          {snapshot.status === 'active' && `Elapsed ${roundedElapsed}`}
          {snapshot.status === 'done' && `done`}
        </div>
      );
    };

    const store = createStore();
    const { findByText } = render(
      <StrictMode>
        <Provider store={store}>
          <TestComponent />
        </Provider>
      </StrictMode>,
    );
    await findByText('done');

    expect(store.get(promiseActorAtom).getSnapshot().output).toEqual(
      store.get(elapsedAtom),
    );
    expect(store.get(roundedElapsed)).toEqual(500);
    // const after = Date.now();
    // const diff = after - before;
    // expect(diff).toBeGreaterThanOrEqual(500);
  });
});
