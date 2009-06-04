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


// exports
({
  "builtinsUncaller": builtinsUncaller,
  "builtinsMaker": builtinsMaker,
  "recordUncaller": recordUncaller
});