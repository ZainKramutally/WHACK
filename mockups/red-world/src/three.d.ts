// three ships no bundled types and we skip @types/three: every THREE/TSL symbol is `any`.
// Prefer importing from 'three/webgpu'. 'three' is declared with a few loose classes so `import type { BufferGeometry }` works.
declare module 'three' {
  type Loose = { [k: string]: any };
  export class BufferGeometry { constructor(...a: any[]); [k: string]: any }
  export class BufferAttribute { constructor(...a: any[]); [k: string]: any }
  export class Float32BufferAttribute { constructor(...a: any[]); [k: string]: any }
  export class Vector3 { constructor(...a: any[]); [k: string]: any }
  export class Matrix4 { constructor(...a: any[]); [k: string]: any }
  export class Quaternion { constructor(...a: any[]); [k: string]: any }
  export class Color { constructor(...a: any[]); [k: string]: any }
  export const MathUtils: Loose;
}
declare module 'three/webgpu';
declare module 'three/tsl';
declare module 'three/addons/*';
