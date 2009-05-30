
// This performs the same algorithm as deASTKit from E-on-Java, with only difference in the output.
var deJSONTreeKit = (function () {
  return {
    toString: function () { return "deJSONTreeKit"; },
    makeBuilder: function () {
      var nextTemp = 0;
      return {
        toString: function () { return "<deJSONTreeKit builder>"; },
        
        buildRoot: function (node) {
          nextTemp = null; // help discourage accidental reuse
          return node;
        },
        
        buildLiteral: function (literal) {
          var t = typeof(literal);
          if (t === "string") {
            return literal;
          } else if (t === "number") {
            // XXX review whether we would like to support explicit ints
            return cajita.freeze(["float64", literal]);
          }
        },

        buildImport: function (varName) {
          return cajita.freeze(["import", varName]);
        },
        
        buildIbid: function (index) {
          // XXX range check
          return cajita.freeze(["ibid", index]);
        },
        
        buildCall: function (recipient, verb, args) {
          return cajita.freeze(["call", recipient, verb, args]);
        },
        
        buildPromise: function () {
          var promiseIndex = nextTemp;
          nextTemp += 2;
          //varReused
          return promiseIndex;
        },
        
        buildDefine: function (rValue) {
          var tempIndex = nextTemp++;
          //varReused[tempIndex] = false; // XXX implement the deASTKit functionality this corresponds to
          var defExpr = cajita.freeze(["define", tempIndex, rValue]);
          return cajita.freeze([defExpr, tempIndex]);
        },
        
        buildDefrec: function (resolverIndex, rValue) {
          var promiseIndex = resolverIndex - 1;
          var defExpr = cajita.freeze(["defrec", promiseIndex, rValue]);
          return defExpr;
        },
        
      }; // end builder
    }
  }; // end deJSONTreeKit
})();

var deSubgraphKit = (function () {
  return {
    toString: function () { return "deSubgraphKit"; },
    makeBuilder: function (env) { 
      var temps = [];
      var nextTemp = 0;
      return {
        toString: function () { return "<deSubgraphKit builder>"; },
        
        buildRoot: function (node) {
          return node;
        },
        
        buildLiteral: function (value) { return value; },
        
        buildImport: function (noun) { 
          if (noun in env) {
            return env[noun];
          } else {
            throw new Error("deSubgraphKit: Import not found: " + noun); // XXX appropriate exception generation?
          }
        },

        buildCall: function (rec, verb, args) { return rec[verb].apply(rec, args); },
        
        buildDefine: function (definition) {
          temps[nextTemp] = definition;
          return [definition, nextTemp++];
        },
        
        buildIbid: function (tempIndex) {
          return temps[tempIndex];
        }
        
      }; // end builder
    }
  }; // end deSubgraphKit
})();


// exports
({
  "deJSONTreeKit": deJSONTreeKit,
  "deSubgraphKit": deSubgraphKit
});