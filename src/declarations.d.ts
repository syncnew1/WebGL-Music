declare module 'jsmediatags/dist/jsmediatags.min.js';
declare module 'opencc-js/t2cn' {
  export function Converter(options: { from: string; to: string }): (input: string) => string
}
