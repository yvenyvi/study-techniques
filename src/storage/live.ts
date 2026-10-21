import {
  useEffect,
  useState,
  useSyncExternalStore,
  type DependencyList,
} from "react";
import { useLiveQuery as useDexieQuery } from "dexie-react-hooks";
import { isDesktop } from "../platform";

let revision = 0;
const listeners = new Set<() => void>();
export function storageChanged() {
  revision++;
  for (const fn of listeners) fn();
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const snapshot = () => revision;

// Platform is fixed for the entire application lifetime.
function useWebQuery<T>(
  query: () => T | Promise<T>,
  deps: DependencyList = [],
): T | undefined {
  return useDexieQuery(query, [...deps]);
}
export const useLiveQuery = isDesktop ? useNativeQuery : useWebQuery;
function useNativeQuery<T>(
  query: () => T | Promise<T>,
  deps: DependencyList = [],
): T | undefined {
  const version = useSyncExternalStore(subscribe, snapshot);
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(query)
      .then(
        (result) => {
          if (!cancelled) {
            setValue(result);
            setError(undefined);
          }
        },
        (err) => {
          if (!cancelled) setError(err);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [...deps, version]);
  if (error) throw error;
  return value;
}
