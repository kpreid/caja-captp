"use strict,cajita";
// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

// Return a portrayal which invokes a JS function.
function portrayCall(func, args) {
  return cajita.freeze([func, "call", cajita.freeze([cajita.USELESS].concat(args))]);
}

// Return a portrayal which invokes a constructor with 'new'.
function portrayConstruct(constructor, args) {
  return cajita.freeze([cajita, "construct", cajita.freeze([constructor, cajita.freeze(args)])]);
}

// Return a portrayal which reads a property.
function portrayRead(obj, name) {
  return cajita.freeze([cajita, "readPub", cajita.freeze([obj, name])]);
}

var builtinsMaker = cajita.freeze({
  toString: function () { return "builtinsMaker"; },

  frozenArray: function () {
    // XXX is this a good way to accomplish this?
    return cajita.snapshot(arguments);
  },
  
  record: function () {
    var record = {};
    for (var i = 0; i < arguments.length; i += 2) {
      record[arguments[i]] = arguments[i+1];
    }
    return cajita.freeze(record);
  }
});

// Uncalls everything in the ECMAScript standard that it is appropriate to, as well as special references and Cajita objects.
// XXX This needs to be put on a firm foundation; right now it's a collection of stuff-that-was-found-necessary.
var builtinsUncaller = cajita.freeze({
  toString: function () { return "builtinsUncaller"; },
  optUncall: function (specimen) {
    if (cajita.isFrozen(specimen) && cajita.isArray(specimen)) {
      // If it's not frozen, it's not pass-by-copy, and not our business
      // XXX is the copy necessary here? The idea is to sanitize an extra-propertied array
      return cajita.freeze([builtinsMaker, "frozenArray", cajita.freeze(cajita.copy(specimen))]);
    }
    
    if (cajita.isDirectInstanceOf(specimen, Error)) {
      // XXX review that we are not checking for frozenness.
      return portrayConstruct(Error, [specimen.message]);
      // XXX handle Error subtypes.
    }
    
    if (Ref.isBroken(specimen)) {
      return cajita.freeze([Ref, "broken", [Ref.optProblem(specimen)]]);
    }
    
    if (specimen === cajita.USELESS) {
      return portrayRead(cajita, "USELESS");
    }
    
    return null;
  }
});

// Uncalls arbitrary records. This is often not what you want since they may be objects with opaque functions in them; for this reason it is not included in the default uncaller list. Use it if you want to serialize e.g. JSON-style structures conveniently.
var recordUncaller = cajita.freeze({
  toString: function () { return "recordUncaller"; },
  optUncall: function (specimen) {
    if (cajita.isRecord(specimen) && cajita.isFrozen(specimen)) {
      var parts = [];
      cajita.forOwnKeys(specimen, function (key, value) {
        parts.push(key);
        parts.push(value);
      });
      return cajita.freeze([builtinsMaker, "record", cajita.freeze(parts)]);
    } else {
      return null;
    }
  }
});

// Uncalls objects with uncall methods.
var selfUncaller = cajita.freeze({
  toString: function () { return "minimalUncaller"; },
  optUncall: function (specimen) {
    if (typeof(specimen) == "object" && specimen !== null && "CapTP__optUncall" in specimen) {
      return specimen.CapTP__optUncall();
    }
    return null;
  }
});

// XXX We should extract this from the Cajita sharedImports, but that is not available from cajoled code.
var sharedImports = cajita.freeze({
  cajita: cajita,

  'null': null,
  'false': false,
  'true': true,
  'NaN': NaN,
  'Infinity': Infinity,
  'undefined': undefined,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  decodeURI: decodeURI,
  decodeURIComponent: decodeURIComponent,
  encodeURI: encodeURI,
  encodeURIComponent: encodeURIComponent,
  escape: escape,
  Math: Math,
  JSON: JSON,

  Object: Object,
  Array: Array,
  String: String,
  Boolean: Boolean,
  Number: Number,
  Date: Date,
  RegExp: RegExp,

  Error: Error,
  EvalError: EvalError,
  RangeError: RangeError,
  ReferenceError: ReferenceError,
  SyntaxError: SyntaxError,
  TypeError: TypeError,
  URIError: URIError
});

// --- CycleBreaker
// A CycleBreaker is a map whose keys may be arbitrary objects; particularly, even promises.
function CycleBreaker() {
  var frozen = false;
  var backing = cajita.newTable(false);
  var keys = [];
  var cb = cajita.freeze({
    toString: function () { return "[CycleBreaker]"; },
    get: function (obj) { return backing.get(obj); },
    set: function (key, value) {
      cajita.enforce(!frozen, "this CycleBreaker is frozen");
      keys.push(key);
      backing.set(key, value);
    },
    copy: function () {
      var d = CycleBreaker();
      for (var i = 0; i < keys.length; i++) {
        d.set(keys[i], backing.get(keys[i]));
      }
      return d;
    },
    freeze: function () {
      frozen = true;
      return cb;
    },
    snapshot: function () {
      return cb.copy().freeze();
    }
  });
  return cb;
}
CycleBreaker.byInverting = function (table) {
  var cb = CycleBreaker();
  cajita.forOwnKeys(table, function (key) {
    cb.set(table[key], key);
  });
  return cb.freeze();
};
cajita.freeze(CycleBreaker);

// --- defaultEnv definition
var defaultEnv = cajita.copy(sharedImports);
defaultEnv["DataE_JS1_builtinsMaker"] = builtinsMaker;
cajita.freeze(defaultEnv);

// --- defaultUnenv definition
var defaultUnenv = cajita.copy(CycleBreaker.byInverting(defaultEnv));
defaultUnenv.toString = function () { return "[Data-E defaultUnenv]"; };
cajita.freeze(defaultUnenv);

// --- defaultUncallers definition
var defaultUncallers = cajita.freeze([selfUncaller, builtinsUncaller]);

// exports
cajita.freeze({
  builtinsMaker: builtinsMaker,
  builtinsUncaller: builtinsUncaller,
  CycleBreaker: CycleBreaker,
  defaultEnv: defaultEnv,
  defaultUncallers: defaultUncallers,
  defaultUnenv: defaultUnenv,
  minimalUncaller: minimalUncaller,
  portrayCall: portrayCall,
  portrayConstruct: portrayConstruct,
  portrayRead: portrayRead,
  recordUncaller: recordUncaller
});