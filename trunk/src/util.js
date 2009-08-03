"use strict,cajita";
// Copyright 2009 Kevin Reid under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

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
  "once": once
});