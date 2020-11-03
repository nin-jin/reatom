## TODO:

- [ ] add `catch` method as a shortcut to `chain(, cb)`
- [ ] add `reason` prop to catched error with link to processed task
- [ ] add method for clone all futures except existing in passed context
- [ ] refactor subscribes mechanism
  > we have a lot of important stages for reaction:
  > instance init, instance update, instance failed update (error),
  > some different kind of instance update (result kind),
  > instance rollback update, instance finalisation,
  > transaction step, transaction failed
  > transaction end.
  > All of it should has a self list of subscribers and methods to manage it,
  > so, may be, we need to more general mechanism to manage
  > list of subscriptions.

## Architecture solutions

> read it from bottom to top

- Earlier I was describe a two problems of reactive futures and now I have an idea of how to solve it both. If the leaf of graph - calculation entry point have an update method with specific name, it may be automatically copied to every derived edge. It not _solve_ a futures problem, it just may bring it functionality to an push-like graph description.
- A little inspired by https://github.com/tc39/proposal-emitter/blob/master/FAQ.md and specially https://github.com/tc39/proposal-emitter/blob/master/FAQ.md#how-does-this-relate-to-observables I rename an edge entity to `Emitter` and basic transaction to `Event` (which `transaction` is an event with rollbacks).
- how to prevent walk propagation under self children (dependent edges)? One of the way is `stopPropagation` method from an `Transaction`, but a problem is what we should return in a function or a brunch of function body? It is a problem because a type system infer a function and edge type from all branches of function body. So one of the solution is use a special token for returned value that will filtered by default in a edge type, but if we already use this token why we need separeted method `stopPropagation`, we may stop propagation just by writing a function result value.
- trying to declain a instance creation for context and replace it by self hosting data and some spicies for clone method
- After many experiments with API for combining links and atoms I come to `join` method, thats get a list of links / atoms, internally combine it by coping it deps and executors and, that is most important and a key feature, share once cache among of them. Before that a `combain` API accept a list or a collection of links and throw a link with union output of payload or the `STOP`, like `combine([a, b]).link((payload: [aPayload | STOP, bPayload | STOP]) => ...)`. It allows process a different payloads thats come in by a one transaction, but it is a rare case and mostly enforce a user to make a checks `if (aPayload !== STOP)` thats looks ugly. Separate each handler for each payload is a more obvious, and if we need to share some logic between of handlers we may use a shared cache. By the way, the `join` method have a 4 letter, thats is beautifully closing a "4 chars" API =D.
- Move observable description from an class to an function for better type inferences and get the possibility of describing many types of things by single method (by overloads). In details, with an class API I have no found any way to describe by one class a thing with dependencies and without dependencies and infer an input type for both of it.
- rename `chain` to `link` and call an observable creator a `link` to as a more short name (4 chars) and unification of API: `const a = link(v => v).link(v => v)`
- have some experiments with a pull approach, like MobX, found that we may store a set of all dependencies leafs in a edge of graph and it possibly a simplest and fastest way to optimize a walk of graph only for necessary edges (MobX build a push graph under pull walk and start a walk from a leaf, i propose remind every dependencies leafs to every edge and start a walk from a bottom of graph with a checks in every edge of needed of walk by checking accessory of it leafs and processed leaf). It is cool approach, but less obvious in some places and still getting a lot of performance impact. By the way, proactive laziness thats we get with this approach concurenting with ACID of all model, because we just not calc a inactive branches of graph and can't be shure thats some of leafs data is compatibl or incompatibl with edges of inactive branches.
- chain should release `stop` if a promise returned, wait it and only then release `next` because otherwise:
  - every link should then's promise and after that, before processing _map_, checks self existence in `transaction.context` (because after transaction creation and before promise resolving it possible to cleanup link instance by unsubscribers)
  - if every link will then's a promise by it self it will release self separately and this may cause excessive subscriptions calls
- Rollback - it a pattern thats helps to support ACID in a push reactivity. It should together inverting and mimic a _catch_ logic from a _pull_ imperative approach.
- changing observables map key type from string to object
  for add possibility to replace a map to weakMap (it is necessary for prevent blocking GC by cyclic links and helping a little with forgotten unsubscribtions)
- do not use a **future** pattern because
  - it facilitate a **very** implicitly code, when u describe A - B1 - C1 in one module, A - B2 - C2 in other module and getting updates from C1 may happen due by?: C1 (explicit), B1 (explicit), A (explicit), B2 (implicit), C2 (implicit) and so on. I was try it, it was totally unobvious.
  - push and pull semantic of combined features is conflictual different in a case of duplicated futures: _pull_ assumes separated processing of each input, _push_ use top sort for only one call of a node (with which input?).
  - with push description it is a little harder to implement under the hood a right returned value from an future call, because one of the edge of futures chain may stop it propagation, but we should propagate it info to a called edge.
