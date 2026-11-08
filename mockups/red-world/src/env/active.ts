// The environment this page renders: ?env=<name> picks a NAMED sample point, ?soup=c,T,N,O[,light[,sea]] sets (or, with
// ?env, overrides) the soup. No query → the Rust World (the adopted Red World look). Read once at startup.
import { environmentFrom, NAMED, parseSoup, type Soup } from './derive';

const q = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const name = q.get('env') ?? '';
const base: Soup = NAMED[name]?.soup ?? NAMED.rust.soup;
export const SOUP: Soup = q.get('soup') ? parseSoup(q.get('soup')!, base) : base;
export const ENV_NAME = NAMED[name] && !q.get('soup') ? name : q.get('soup') ? 'custom' : 'rust';
export const ENV = environmentFrom(SOUP);
