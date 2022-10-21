// SPDX-License-Identifier: MIT
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

// A shim for the libWrapper library
export let libWrapper = undefined;

export const VERSIONS = [1, 12, 2];
export const TGT_SPLIT_RE = new RegExp(
  '([^.[]+|\\[(\'([^\'\\\\]|\\\\.)+?\'|"([^"\\\\]|\\\\.)+?")\\])',
  'g'
);
export const TGT_CLEANUP_RE = new RegExp('(^\\[\'|\'\\]$|^\\["|"\\]$)', 'g');

// Main shim code
Hooks.once('init', () => {
  // Check if the real module is already loaded - if so, use it
  if (globalThis.libWrapper && !(globalThis.libWrapper.is_fallback ?? true)) {
    libWrapper = globalThis.libWrapper;
    return;
  }

  // Fallback implementation
  libWrapper = class {
    static get is_fallback() {
      return true;
    }

    static get WRAPPER() {
      return 'WRAPPER';
    }
    static get MIXED() {
      return 'MIXED';
    }
    static get OVERRIDE() {
      return 'OVERRIDE';
    }

    static register(package_id, target, fn, type = 'MIXED', { chain = undefined, bind = [] } = {}) {
      const is_setter = target.endsWith('#set');
      target = !is_setter ? target : target.slice(0, -4);
      const split = target
        .match(TGT_SPLIT_RE)
        .map((x) => x.replace(/\\(.)/g, '$1').replace(TGT_CLEANUP_RE, ''));
      const root_nm = split.splice(0, 1)[0];

      let obj, fn_name;
      if (split.length == 0) {
        obj = globalThis;
        fn_name = root_nm;
      } else {
        const _eval = eval;
        fn_name = split.pop();
        obj = split.reduce((x, y) => x[y], globalThis[root_nm] ?? _eval(root_nm));
      }

      let iObj = obj;
      let descriptor = null;
      while (iObj) {
        descriptor = Object.getOwnPropertyDescriptor(iObj, fn_name);
        if (descriptor) break;
        iObj = Object.getPrototypeOf(iObj);
      }
      if (!descriptor || descriptor?.configurable === false)
        throw new Error(
          `libWrapper Shim: '${target}' does not exist, could not be found, or has a non-configurable descriptor.`
        );

      let original = null;
      const wrapper =
        chain ?? (type.toUpperCase?.() != 'OVERRIDE' && type != 3)
          ? function (...args) {
              return fn.call(this, original.bind(this), ...bind, ...args);
            }
          : function (...args) {
              return fn.call(this, ...bind, ...args);
            };
      if (!is_setter) {
        if (descriptor.value) {
          original = descriptor.value;
          descriptor.value = wrapper;
        } else {
          original = descriptor.get;
          descriptor.get = wrapper;
        }
      } else {
        if (!descriptor.set) throw new Error(`libWrapper Shim: '${target}' does not have a setter`);
        original = descriptor.set;
        descriptor.set = wrapper;
      }

      descriptor.configurable = true;
      Object.defineProperty(obj, fn_name, descriptor);
    }
  };

  //************** USER CUSTOMIZABLE:
  // Set up the ready hook that shows the "libWrapper not installed" warning dialog. Remove if undesired.
  {
    //************** USER CUSTOMIZABLE:
    // Package ID & Package Title - by default attempts to auto-detect, but you might want to hardcode your package ID and title here to avoid potential auto-detect issues
    const [PACKAGE_ID, PACKAGE_TITLE] = (() => {
      const match = (import.meta?.url ?? Error().stack)?.match(
        /\/(worlds|systems|modules)\/(.+)(?=\/)/i
      );
      if (match?.length !== 3) return [null, null];
      const dirs = match[2].split('/');
      if (match[1] === 'worlds')
        return dirs.find((n) => n && game.world.id === n)
          ? [game.world.id, game.world.title]
          : [null, null];
      if (match[1] === 'systems')
        return dirs.find((n) => n && game.system.id === n)
          ? [game.system.id, game.system.title ?? game.system.data.title]
          : [null, null];
      const id = dirs.find((n) => n && game.modules.has(n));
      const mdl = game.modules.get(id);
      return [id, mdl?.title ?? mdl?.data?.title];
    })();

    if (!PACKAGE_ID || !PACKAGE_TITLE) {
      console.error(
        'libWrapper Shim: Could not auto-detect package ID and/or title. The libWrapper fallback warning dialog will be disabled.'
      );
      return;
    }
  }
});
