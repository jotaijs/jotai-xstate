/* eslint @typescript-eslint/no-explicit-any: off */

import type { Getter, WritableAtom } from 'jotai/vanilla';
import { atom } from 'jotai/vanilla';
import { type AnyActor, type SnapshotFrom, type Subscription } from 'xstate';
import { isGetter } from './utils.js';

export function atomWithActorSnapshot<TActor extends AnyActor>(
  getActor: TActor | ((get: Getter) => TActor),
): WritableAtom<SnapshotFrom<TActor>, never[], void> {
  const actorAtom = atom((get) =>
    isGetter(getActor) ? getActor(get) : getActor,
  );

  const cachedActorSnapshotAtom = atom<SnapshotFrom<TActor> | null>(null);
  if (process.env.NODE_ENV !== 'production') {
    cachedActorSnapshotAtom.debugPrivate = true;
  }

  const cachedSubscriptionAtom = atom<Subscription | null>(null);
  const subscriptionAtom = atom(
    (get) => {
      const cachedSub = get(cachedSubscriptionAtom);
      if (!cachedSub) {
        return { unsubscribe() {} };
      }
      return cachedSub;
    },
    (get, set, dontRenew = false) => {
      const previousSub = get(subscriptionAtom);
      if (previousSub) {
        previousSub.unsubscribe();
      }
      if (dontRenew) return;

      const actor = get(actorAtom);
      set(cachedActorSnapshotAtom, actor.getSnapshot());

      const sub = actor.subscribe((nextSnapshot: SnapshotFrom<TActor>) => {
        set(cachedActorSnapshotAtom, nextSnapshot);
      });
      set(cachedSubscriptionAtom, sub);
    },
  );

  const actorSnapshotAtom = atom(
    (get) => {
      get(subscriptionAtom);
      return (
        get(cachedActorSnapshotAtom) ??
        (get(actorAtom).getSnapshot() as SnapshotFrom<TActor>)
      );
    },
    (_, set, registerCleanup: (cleanup: () => void) => void) => {
      set(subscriptionAtom);
      registerCleanup(() => {
        set(cachedActorSnapshotAtom, null);
        set(cachedSubscriptionAtom, null);
        set(subscriptionAtom, true);
      });
    },
  );

  actorSnapshotAtom.onMount = (initialize) => {
    let unsub: (() => void) | undefined | false;

    initialize((cleanup) => {
      if (unsub === false) {
        cleanup();
      } else {
        unsub = cleanup;
      }
    });

    return () => {
      if (unsub) {
        unsub();
      }
      unsub = false;
    };
  };

  const clearableSnapshotAtom = atom(
    (get) => get(actorSnapshotAtom),
    (_, set) => {
      set(cachedSubscriptionAtom, null);
      set(subscriptionAtom);
    },
  );
  return clearableSnapshotAtom;
}
