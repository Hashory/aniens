import { computed as vueComputed, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';

export interface Signal<T> {
  (): T;
  asReadonly(): Signal<T>;
}

export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

export function signal<T>(initialValue: T): WritableSignal<T> {
  const state = shallowRef(initialValue) as ShallowRef<T>;
  const read = (() => state.value) as WritableSignal<T>;

  read.set = (value: T) => {
    state.value = value;
  };
  read.update = (updater: (value: T) => T) => {
    state.value = updater(state.value);
  };
  read.asReadonly = () => read;

  return read;
}

export function computed<T>(getter: () => T): Signal<T> {
  const value = vueComputed(getter);
  const read = (() => value.value) as Signal<T>;

  read.asReadonly = () => read;

  return read;
}
