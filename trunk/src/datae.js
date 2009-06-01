
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
          } else {
            throw new Error("deJSONTreeKit: This is not a literal: " + literal);
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
    },
    
    makeRecognizer: function (uncallers, unenv) {
      return {
        toString: function () { return "<deSubgraphKit recognizer>"; },
        
        recognize: function (specimen, builder) {
          cajita.enforceType(builder, "object", "deSubgraphKit.recognize's builder");
          
          // subRecog is the recursive processor of a single object being serialized.
          var subRecog = function (obj) {
            // There are four possible results from serializing an object, indicated below
            
            var unenvLookup = unenv.get(obj);
            if (unenvLookup !== undefined) {
              // 1. The object is an exit.
              
              // XXX using undefined here because that's what a cajita.newTable() returns for misses -- should we do otherwise, eg using null? -- kpreid 2009-05-31
              //cajita.enforceType(unenvLookup, "string") // not yet tested
              return builder.buildImport(unenvLookup);
            } else if (typeof(obj) == "string" || typeof(obj) == "number") {
              // 2. The object is a literal.
              return builder.buildLiteral(obj);
            } else {
              // XXX implement
              // 3. The object is composite (gets uncalled).
              for (var i = 0; i < uncallers.length; i++) {
                // An uncaller returns either a 3-tuple or null.
                var optPortrayal = uncallers[i].optUncall(obj);
                if (optPortrayal !== null) {
                  var recipBuilt = subRecog(optPortrayal[0]);
                  var argsObjs = optPortrayal[2];
                  var argsBuilt = [];
                  for (var j = 0; j < argsObjs.length; j++) {
                    argsBuilt[j] = subRecog(argsObjs[j]);
                  }
                  return builder.buildCall(recipBuilt, optPortrayal[1], cajita.freeze(argsBuilt));
                }
              }

              // 4. The object is not serializable.
              throw new Error("deSubgraphKit: can't uneval: " + obj);
            }
          }; // end subRecog
          
          return builder.buildRoot(subRecog(specimen));
        },
      }; // end recognizer
    },
    
  }; // end deSubgraphKit
})();


// exports
({
  "deJSONTreeKit": deJSONTreeKit,
  "deSubgraphKit": deSubgraphKit
});