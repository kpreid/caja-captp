"use cajita";
// Copyright 2009 Kevin Reid under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

function throwAndCatch(e) {
  try { throw e; } catch (ee) { return ee; }
}

// exports
cajita.freeze({
  "throwAndCatch": throwAndCatch
});