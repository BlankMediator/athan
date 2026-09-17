import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from 'react/jsx-runtime';
import { t } from './runtime';
export { Fragment };
/** Translate presentation text during React element creation; never mutate DOM or input values. */
export function localizedProps(type: unknown, props: any) {
  if (typeof type !== 'string' || !props || props['data-source-text'] || props.lang) return props;
  const translateChild = (value: unknown): unknown => {
    if (typeof value === 'string') return t(value);
    if (!Array.isArray(value)) return value;
    const result: unknown[] = []; let run: (string | number)[] = [];
    const flush = () => { if (!run.length) return; const message = run.join(''), translated = t(message); result.push(...(translated !== message ? [translated] : run.map(part => typeof part === 'string' ? t(part) : part))); run = []; };
    for (const part of value) { if (typeof part === 'string' || typeof part === 'number') run.push(part); else { flush(); result.push(translateChild(part)); } }
    flush(); return result;
  };
  const next = { ...props, children: translateChild(props.children) };
  if (!props.dir && ['span', 'small', 'strong', 'p', 'h1', 'h2', 'h3', 'h4', 'option'].includes(type) &&
    (typeof next.children === 'string' || typeof next.children === 'number' || Array.isArray(next.children) && next.children.every((v: unknown) => typeof v === 'string' || typeof v === 'number'))) next.dir = 'auto';
  for (const key of ['title', 'aria-label', 'placeholder', 'alt']) if (typeof next[key] === 'string') next[key] = t(next[key]);
  return next;
}
export const jsx: typeof reactJsx = (type, props, key) => reactJsx(type, localizedProps(type, props), key);
export const jsxs: typeof reactJsxs = (type, props, key) => reactJsxs(type, localizedProps(type, props), key);
export type { JSX } from 'react/jsx-runtime';
