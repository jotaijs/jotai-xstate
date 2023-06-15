import {
  type ActorRef,
  type AnyEventObject,
  fromTransition,
  interpret,
} from 'xstate'

const emptyLogic = fromTransition((_) => undefined, undefined)
export function createEmptyActor(): ActorRef<AnyEventObject, undefined> {
  return interpret(emptyLogic)
}
