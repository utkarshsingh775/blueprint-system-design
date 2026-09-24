import { useSyncExternalStore } from 'react';

const KEY = 'blueprint.progress.v1';
const listeners = new Set();
let state = (() => {
  try {
    return { done: {}, quiz: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { done: {}, quiz: {} };
  }
})();

const save = (next) => {
  state = next;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
};

export const progress = {
  toggleDone: (id) => save({ ...state, done: { ...state.done, [id]: !state.done[id] } }),
  markDone: (id) => !state.done[id] && save({ ...state, done: { ...state.done, [id]: true } }),
  saveQuiz: (id, score, total) => save({ ...state, quiz: { ...state.quiz, [id]: { score, total } } }),
  reset: () => save({ done: {}, quiz: {} }),
};

export const useProgress = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state
  );
