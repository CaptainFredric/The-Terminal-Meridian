const STATE_UPDATED = "STATE_UPDATED";

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function clonePath(path, key) {
  return [...path, String(key)];
}

export function createStateStore(initialState = {}) {
  const eventTarget = new EventTarget();
  const proxyCache = new WeakMap();
  let lastMutation = null;

  const emit = (detail) => {
    lastMutation = detail;
    const event = new CustomEvent(STATE_UPDATED, { detail });
    eventTarget.dispatchEvent(event);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(STATE_UPDATED, { detail }));
    }
  };

  const wrapCollection = (target, path) => {
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
      get(collection, property, receiver) {
        const value = Reflect.get(collection, property, receiver);

        if (collection instanceof Map && ["set", "delete", "clear"].includes(property)) {
          return (...args) => {
            const key = args[0];
            const previousValue = property === "set" || property === "delete" ? collection.get(key) : undefined;
            const result = Map.prototype[property].apply(collection, args);
            const nextValue = property === "set" ? collection.get(key) : undefined;
            emit({
              path: property === "clear" ? path : clonePath(path, key),
              property,
              key,
              value: nextValue,
              previousValue,
              oldState: previousValue,
              newState: nextValue,
              target: collection,
            });
            return result;
          };
        }

        if (collection instanceof Set && ["add", "delete", "clear"].includes(property)) {
          return (...args) => {
            const beforeSize = collection.size;
            const result = Set.prototype[property].apply(collection, args);
            emit({ path, property, value: args[0], previousValue: beforeSize, target: collection });
            return result;
          };
        }

        if (collection instanceof Map && property === "get") {
          return (key) => {
            const result = Map.prototype.get.call(collection, key);
            return isObjectLike(result) ? createReactive(result, clonePath(path, key)) : result;
          };
        }

        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  };

  const createReactive = (target, path = []) => {
    if (!isObjectLike(target)) return target;
    if (target instanceof Map || target instanceof Set) {
      return wrapCollection(target, path);
    }
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
      get(currentTarget, property, receiver) {
        const value = Reflect.get(currentTarget, property, receiver);
        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
      set(currentTarget, property, value, receiver) {
        const previousValue = currentTarget[property];
        const nextValue = isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
        const didSet = Reflect.set(currentTarget, property, nextValue, receiver);
        if (didSet && previousValue !== value) {
          emit({
            path: clonePath(path, property),
            property,
            value,
            previousValue,
            oldState: previousValue,
            newState: value,
            target: currentTarget,
          });
        }
        return didSet;
      },
      deleteProperty(currentTarget, property) {
        const previousValue = currentTarget[property];
        const didDelete = Reflect.deleteProperty(currentTarget, property);
        if (didDelete) {
          emit({
            path: clonePath(path, property),
            property,
            value: undefined,
            previousValue,
            oldState: previousValue,
            newState: undefined,
            target: currentTarget,
          });
        }
        return didDelete;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  };

  const state = createReactive(
    structuredClone({
      activeRules: [],
      notifications: [],
      ...initialState,
    }),
  );

  return {
    STATE_UPDATED,
    state,
    subscribe(listener) {
      eventTarget.addEventListener(STATE_UPDATED, listener);
      return () => eventTarget.removeEventListener(STATE_UPDATED, listener);
    },
    getLastMutation() {
      return lastMutation;
    },
    dispatch(detail) {
      emit(detail);
    },
  };
}

export { STATE_UPDATED };
