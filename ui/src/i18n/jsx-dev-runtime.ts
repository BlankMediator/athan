import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime';
import { localizedProps } from './jsx-runtime';
export { Fragment } from 'react/jsx-runtime';
export const jsxDEV: typeof reactJsxDEV = (type, props, key, isStatic, source, self) => reactJsxDEV(type, localizedProps(type, props), key, isStatic, source, self);
export type { JSX } from 'react/jsx-runtime';
