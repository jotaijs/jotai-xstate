# jotai-xstate

👻🤖

Jotai integration library for XState

https://jotai.org/docs/integrations/xstate

## Usage

### `atomWithActor`

Creates an atom that creates, stores and manages an Actor, given it's logic. Follows mostly the same API as [`createActor`](https://www.jsdocs.io/package/xstate#createActor).

```tsx
const promiseLogic = fromPromise(() => fetch('http://some.host/...')) // or fromTransition, fromObservable, fromEventObservable, fromCallback, createMachine
const actorAtom = atomWithActor(promiseLogic)

const Component = () => {
    const [actorRef, send] = useAtom(actorAtom)
    ...
}
```

Can also be called with a second `opts` argument for setting up actor parameters. In typescript it's important to correctly type the actors Input, Output and Events. Refer to the [examples](examples/01_typescript/src/app.tsx) for a full implementation

```tsx
const promiseLogic = fromPromise(({ input }: { input: { id: number } }) =>
    fetch(`http://some.host/${input.id}`),
);

const actorAtom = atomWithActor(promiseLogic, { input: { id: 2 } });
//                                              ^ Will type-error if you don't provide input
```

Either param can also be a Getter function, allowing you to derive data from other atoms

```tsx
const promiseLogicAtom = atom(fromPromise(({ input }: { input: { id: number } }) =>
    fetch(`http://some.host/${input.id}`),
));

const idAtom = atom(2)

const actorAtom = atomWithActor((get) => get(promiseLogicAtom), (get) => {
    return { input: { id: get(idAtom) } }
});
```

You can fully type all inputs, outputs and events.

```tsx
type PromiseLogicOutput = string;
type PromiseLogicInput = { duration: number };
type PromiseLogicEvents =
| { type: 'elapsed'; value: number }
| { type: 'completed' };

const promiseLogicAtom = atom(
    fromPromise<PromiseLogicOutput, PromiseLogicInput, PromiseLogicEvents>(
        async ({ emit, input }) => {
            const start = Date.now();
            let now = Date.now();
            do {
                await new Promise((res) => setTimeout(res, 200));
                emit({ type: 'elapsed', value: now - start });
                now = Date.now();
            } while (now - start < input.duration);
            emit({ type: 'completed' });
            return 'Promise finished';
        },
    ),
);

const actorAtom = atomWithActor((get) => get(promiseLogicAtom), {
    input: { duration: 3000 },
});

const Component = () => {
    // actorRef allows access to the return of 'createActor'
    const [actorRef, send] = useAtom(actorAtom);

    useEffect(() => {
        const subscription = actorRef.on('elapsed', console.log);
        return () => subscription.unsubscribe;
    }, [actorRef]);

    return ...
};
````

**Important!!**
By default `atomWithActor` will call `actor.start()` as soon as it mounts. To change this behaviour you can provide `{ autoStart: false }` in your options and start it manually

```tsx
const promiseLogic = fromPromise(
    () => new Promise((res) => setTimeout(res, 1000)),
); // or fromTransition, fromObservable, fromEventObservable, fromCallback, createMachine
const actorAtom = atomWithActor(promiseLogic, { autoStart: false });

const Component = () => {
    const [actorRef, send] = useAtom(actorAtom);
    return (
        <button onClick={() => actorRef.start()}>
            Click me to start the timeout
        </button>
    );
};
```

### `atomWithActorSnapshot`

Provides access to an actors up-to-date [`snapshot`](https://www.jsdocs.io/package/xstate#Actor.getSnapshot) while also handling it's lifecycle and listeners. Takes in an instanced actor or a getter function that returns one.

```tsx
type PromiseLogicOutput = string
// or fromTransition, fromObservable, fromEventObservable, fromCallback, createMachine
const promiseLogic = fromPromise<PromiseLogicOutput>(() => new Promise(
    res => setTimeout(() => res("Return from inside logic"), 1000)
))

const actorAtom = atomWithActor(promiseLogic)
// Here get() is required because the actor logic is also stored in an atom
const actorSnapshot = atomWithActorSnapshot(get => get(actorAtom))

const Component = () => {
    const [actorRef, send] = useAtom(actorAtom)
    const [snapshot, clear] = useAtom(actorSnapshot)
    return (
        <div>
            {snapshot.state === "active" && "Waiting on timeout"}
            {snapshot.state === "done" && `Timeout done! Actor output is: ${snapshot.output}`}
        </div>
    )
        ...
}
```

Calling this atom's `write` function (named `clear` in the example above) will clear the internal snapshot and reset the listeners. This is usefull when combined with calling `send(RESTART)` on the actor logic, especially when it depends on derived values.

```tsx
type PromiseLogicOutput = string
type PromiseLogicInput = { duration: number }
// or fromTransition, fromObservable, fromEventObservable, fromCallback, createMachine
const promiseLogic = fromPromise<PromiseLogicOutput, PromiseLogicInput>(({input}) => new Promise(
    res => setTimeout(() => res("Return from inside logic"), input.duration)
))

const durationAtom = atom(1000)

const actorAtom = atomWithActor(promiseLogic)
// Here get() is required because the actor logic is also stored in an atom
const actorSnapshot = atomWithActorSnapshot(get => get(actorAtom))

const Component = () => {
    const [actorRef, send] = useAtom(actorAtom)
    const [snapshot, clear] = useAtom(actorSnapshot)
    const [duration, setDuration] = useAtom(durationAtom)
    return (
        <div>
            {snapshot.state === "active" && "Waiting on timeout"}
            {snapshot.state === "done" && (
                <div>
                    Waited for {duration}ms
                    <br>
                    Actor output is: {snapshot.output}
                    <button onClick={() => {
                      // The order here is important.
                     // First we set the duration
                      setDuration(duration + 1000)
                      // Then we reset the actor. This will start it with the new input
                      send(RESTART)
                      // Then we clear the snapshot, resetting the listeners on the new instance of the actor
                      clear()
                    }}>Wait {duration + 1000}ms</button>
                </div>
            )}
        </div>
    )
        ...
}
```

### `atomWithMachine`

https://jotai.org/docs/integrations/xstate
