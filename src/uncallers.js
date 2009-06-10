// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

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
  },
});

// Return an uncall which invokes a constructor with 'new'
function constructorUncall(constructor, args) {
  return cajita.freeze([cajita, "construct", cajita.freeze([constructor, cajita.freeze(args)])]);
}

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
      return constructorUncall(Error, [specimen.message]);
    }
    
    return null;
  },
});

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
  },
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

// --- defaultEnv definition
var defaultEnv = cajita.copy(sharedImports);
defaultEnv["DataE_JS1_builtinsMaker"] = builtinsMaker;
cajita.freeze(defaultEnv);

// --- defaultUnenv definition
// XXX defining unenvs as functions is bad for efficient union -- but it's difficult to do better given our options for object-keyed tables...
var unenvBacking = cajita.newTable();
cajita.forOwnKeys(defaultEnv, function (key) {
  unenvBacking.set(defaultEnv[key], key);
});
function defaultUnenv(specimen) {
  return unenvBacking.get(specimen);
};
defaultUnenv.toString = function () { return "[Data-E defaultUnenv]"; };

// exports
({
  "builtinsUncaller": builtinsUncaller,
  "builtinsMaker": builtinsMaker,
  "recordUncaller": recordUncaller,
  "defaultEnv": defaultEnv,
  "defaultUnenv": defaultUnenv,
});