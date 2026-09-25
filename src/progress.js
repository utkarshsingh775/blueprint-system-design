import { useSyncExternalStore } from 'react';

const KEY = 'blueprint.progress.v1';
const listeners = new Set();
let state = (() => {
  try {
    return { done: {}, quiz: {}, check: {}, attempts: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { done: {}, quiz: {}, check: {}, attempts: {} };
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
  toggleCheck: (id, i) => {
    const list = { ...(state.check[id] || {}), [i]: !state.check[id]?.[i] };
    save({ ...state, check: { ...state.check, [id]: list } });
  },
  saveAttempt: (key, text) => save({ ...state, attempts: { ...state.attempts, [key]: text } }),
  reset: () => save({ done: {}, quiz: {}, check: {}, attempts: {} }),
};

export const useProgress = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state
  );
