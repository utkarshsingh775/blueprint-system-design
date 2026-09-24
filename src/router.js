import { useEffect, useState } from 'react';

const parse = () => {
  const path = location.hash.replace(/^#/, '') || '/';
  const [, section = '', id = ''] = path.split('/');
  return { path, section, id };
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path) => (location.hash = path);
