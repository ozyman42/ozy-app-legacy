import { StoreApi, UseBoundStore } from "zustand";
import { ObjectTyped } from 'object-typed';

export type StoreSelector<T, A> = { 
    [k in (keyof T | '$')]: 
        k extends keyof T ?
            StoreSelector<
                Omit<T, k>,
                {
                    [a in (keyof A | k)]:
                        a extends keyof A ?
                            A[a]
                        : a extends k ?
                            T[a]
                        :
                            never
                }
            >
        : k extends '$' ?
            A
        :
            never;
};
  
// eslint-disable-next-line @typescript-eslint/ban-types
export function useStoreSelector<T extends object>(useStore: UseBoundStore<StoreApi<T>>): StoreSelector<T, {}> {
    const accumulatedKeys = new Set<keyof T>();
    const accumulator = {};
    let setup = false;
    useStore(store => {
        if (!setup) {
            ObjectTyped.keys(store).forEach(k => {
                const currentKey = k;
                Object.defineProperty(accumulator, currentKey, {
                    get: function() {
                        accumulatedKeys.add(currentKey);
                        return accumulator;
                    }
                });
            });
            setup = true;
        }
        return {};
    })
    Object.defineProperty(accumulator, '$', {
        get: function() {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            return useStore(state => {
                const selected: Partial<T> = {};
                accumulatedKeys.forEach(k => { selected[k] = state[k]; });
                return selected;
            });
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return accumulator as any;
}