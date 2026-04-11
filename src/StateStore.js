const STATE_UPDATED = "STATE_UPDATED";

// Symbol used as an escape hatch to retrieve the underlying raw target from any proxy
const RAW = Symbol("raw");

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function clonePath(path, key) {
  return [...path, String(key)];
}

// Unwrap any reactive proxy to get the raw underlying object/collection
function toRaw(value) {
  if (!isObjectLike(value)) return value;
  // Walk the chain in case of accidental double-wrapping
  let current = value;
  while (isObjectLike(current) && current[RAW] !== undefined) {
    current = current[RAW];
  }
  return current;
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
    // Always work with the raw underlying collection, never a proxy
    const raw = toRaw(target);

    if (proxyCache.has(raw)) return proxyCache.get(raw);

    const proxy = new Proxy(raw, {
      get(collection, property, receiver) {
        // Escape hatch: expose the raw collection
        if (property === RAW) return collection;

        // Bind read-only iteration methods directly to the raw collection
        // so they never fail due to incompatible Proxy receivers
        if (typeof property === "string") {
          if (collection instanceof Map) {
            if (["has", "forEach", "entries", "values", "keys"].includes(property)) {
              return Map.prototype[property].bind(collection);
            }
            if (property === "get") {
              return (key) => {
                const result = Map.prototype.get.call(collection, key);
                return isObjectLike(result) ? createReactive(result, clonePath(path, key)) : result;
              };
            }
            if (["set", "delete", "clear"].includes(property)) {
              return (...args) => {
                const key = args[0];
                const previousValue = (property === "set" || property === "delete") ? Map.prototype.get.call(collection, key) : undefined;
                const result = Map.prototype[property].apply(collection, args);
                const nextValue = property === "set" ? Map.prototype.get.call(collection, key) : undefined;
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
          }

          if (collection instanceof Set) {
            if (["has", "forEach", "entries", "values", "keys"].includes(property)) {
              return Set.prototype[property].bind(collection);
            }
            if (["add", "delete", "clear"].includes(property)) {
              return (...args) => {
                const beforeSize = collection.size;
                const result = Set.prototype[property].apply(collection, args);
                emit({ path, property, value: args[0], previousValue: beforeSize, target: collection });
                return result;
              };
            }
          }
        }

        // .size is a getter on the prototype — access it directly
        if (property === "size") return collection.size;

        const value = Reflect.get(collection, property, receiver);
        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
    });

    proxyCache.set(raw, proxy);
    return proxy;
  };

  const createReactive = (target, path = []) => {
    if (!isObjectLike(target)) return target;

    // Unwrap any proxy before processing — prevents double-wrapping
    const raw = toRaw(target);

    if (raw instanceof Map || raw instanceof Set) {
      return wrapCollection(raw, path);
    }
    if (proxyCache.has(raw)) return proxyCache.get(raw);

    const proxy = new Proxy(raw, {
      get(currentTarget, property, receiver) {
        // Escape hatch
        if (property === RAW) return currentTarget;
        const value = Reflect.get(currentTarget, property, receiver);
        return isObjectLike(value) ? createReactive(value, clonePath(path, property)) : value;
      },
      set(currentTarget, property, value, receiver) {
        const previousValue = currentTarget[property];
        // Store the raw value — never store a proxy in the underlying object.
        // The get trap wraps lazily on next read, and proxyCache prevents re-creation.
        const rawValue = toRaw(value);
        const didSet = Reflect.set(currentTarget, property, rawValue);
        if (didSet && previousValue !== rawValue) {
          emit({
            path: clonePath(path, property),
            property,
            value: rawValue,
            previousValue,
            oldState: previousValue,
            newState: rawValue,
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

    proxyCache.set(raw, proxy);
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
