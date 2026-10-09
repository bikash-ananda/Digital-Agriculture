import { nav } from '../data/office';

export function findNav(pathname) {
  for (const item of nav) {
    if (item.to && item.to === pathname) return { item, parent: null };
    if (item.children) {
      const c = item.children.find(([to]) => to === pathname);
      if (c) return { item: { to: c[0], label: c[1] }, parent: item };
    }
  }
  return null;
}
