"use cajita";
// Copyright 2009 Kevin Reid under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

/**
 * Are x and y not observably distinguishable?
 * 
 * -- Copied from cajita.js until such time as it exposes this function itself.
 */
function identical(x, y) {
  if (x === y) {
    // 0 === -0, but they are not identical
    return x !== 0 || 1/x === 1/y;
  } else {
    // NaN !== NaN, but they are identical.
    // NaNs are the only non-reflexive value, i.e., if x !== x,
    // then x is a NaN.
    return x !== x && y !== y;
  }
}

function once(func) {
  var live = true;
  function onceFunc() {
    if (live) {
      live = false;
      return func.apply(cajita.USELESS, arguments);
    } else {
      throw new Error("once: tried to call more than once: " + func);
    }
  }
  return onceFunc;
}

// exports
cajita.freeze({
  identical: identical,
  once: once
});