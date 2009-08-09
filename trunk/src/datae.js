"use strict,cajita";
// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

// This performs the same algorithm as deASTKit from E-on-Java, with only difference in the output.
var deJSONTreeKit = (function () {
  function jsonAtomType(x) {
    return typeof(x) === "string" || typeof(x) === "number";
  }
  
  return cajita.freeze({
    toString: function () { return "deJSONTreeKit"; },
    makeBuilder: function () {
      var nextTemp = 0;
      return cajita.freeze({
        toString: function () { return "<deJSONTreeKit builder>"; },
        
        buildRoot: function (node) {
          nextTemp = null; // help discourage accidental reuse
          return node;
        },
        
        atomType: function () { return jsonAtomType; },
        
        buildAtom: function (atom) {
          var t = typeof(atom);
          if (t === "string" || t === "number") {
            return atom;
          } else {
            throw new Error("deJSONTreeKit: This is not an atom: " + atom);
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
        
      }); // end builder
    },

    // Accept a JSON structure and drive the builder to build corresponding structure.
    recognize: function (specimen, builder) {
      
      // Maps the temp indexes in the input to the temp indexes used by the builder.
      var tempMap = {};
      
      var handlers = {
        recog_import: function (tag, name) { 
          return builder.buildImport(name);
        },
        recog_call: function (tag, rec, verb, argsIn) {
          var argsBuilt = [];
          for (var i = 0; i < argsIn.length; i++) {
            argsBuilt[i] = subRecog(argsIn[i]);
          }
          argsBuilt = cajita.freeze(argsBuilt);
          // XXX this operates in the wrong order - prove it
          var recBuilt = subRecog(rec);
          //return cajita.freeze([recBuilt, verb, argsBuilt]);
          return builder.buildCall(recBuilt, verb, argsBuilt);
        },
        recog_define: function (tag, inputTempIndex, rValue) {
          var tuple = builder.buildDefine(subRecog(rValue));
          var result = tuple[0];
          var builtTempIndex = tuple[1];
          tempMap[inputTempIndex] = builtTempIndex;
          return result;
        },
        recog_ibid: function (tag, inputTempIndex) {
          return builder.buildIbid(tempMap[inputTempIndex]);
        },
      };
      
      var subRecog = function (jsonValue) {
        if (typeof(jsonValue) === "string" || typeof(jsonValue) === "number") {
          return builder.buildAtom(jsonValue);
        } else if (typeof(jsonValue) == "object") {
          // assuming it's an array
          return handlers["recog_" + jsonValue[0]].apply(cajita.USELESS, jsonValue);
        } else {
          // XXX test for handling this case
        }
      };
      
      return builder.buildRoot(subRecog(specimen));
    },

  }); // end deJSONTreeKit
})();

var deSubgraphKit = (function () {
  function subgraphAtomType(x) {
    return true;
  }
  
  return cajita.freeze({

    toString: function () { return "deSubgraphKit"; },

    // XXX review: Given magic property names, it safe to use JS properties with no prefix/suffix as the env?
    makeBuilder: function (env) { 
      var temps = [];
      var nextTemp = 0;
      return {
        toString: function () { return "<deSubgraphKit builder>"; },
        
        buildRoot: function (node) {
          return node;
        },
        
        atomType: function () { return subgraphAtomType; },
        buildAtom: function (value) { return value; },
        
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
      return cajita.freeze({
        toString: function () { return "<deSubgraphKit recognizer>"; },
        
        recognize: function (specimen, builder) {
          cajita.enforceType(builder, "object", "deSubgraphKit.recognize's builder");
          
          var atomType = builder.atomType();
          
          // subRecog is the recursive processor of a single object being serialized.
          var subRecog = function (obj) {
            // There are four possible results from serializing an object, indicated below
            
            var unenvLookup = unenv.get(obj);
            if (unenvLookup !== undefined) {
              // 1. The object is an exit.
              
              // XXX using undefined here because that's what a cajita.newTable() returns for misses -- should we do otherwise, eg using null? -- kpreid 2009-05-31
              //cajita.enforceType(unenvLookup, "string") // not yet tested
              return builder.buildImport(unenvLookup);
            } else if (atomType(obj)) {
              // 2. The object is an atom.
              return builder.buildAtom(obj);
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
      }); // end recognizer
    },
    
  }); // end deSubgraphKit
})();

// Kit for JavaScript source text. Very incomplete; used only for debugging.
var deJavaScriptKit = (function () {
  return cajita.freeze({

    toString: function () { return "deJavaScriptKit"; },

    makeBuilder: function () { 
      var temps = [];
      var nextTemp = 0;
      return {
        toString: function () { return "[deJavaScriptKit builder]"; },
        
        buildRoot: function (node) {
          return node;
        },
        
        buildAtom: function (value) {
          switch (typeof(value)) {
            case "string": return "\"" + value.replace(new RegExp("[\\\"]", "g"), "\\$&") + "\"";
            default: return "" + value;
          }
        },
        
        buildImport: function (noun) { return noun; },

        // XXX handle non-dot verbs.
        buildCall: function (rec, verb, args) {
          if (rec === "builtinsMaker" && verb === "frozenArray") { // prettiness kludge
            return "cajita.freeze([" + args.join(", ") + "])";
          } else {
            return rec + "." + verb + "(" + args.join(", ") + ")";
          }
        },
        
        // XXX declare temps
        buildDefine: function (definition) {
          temps[nextTemp] = definition;
          return [definition, nextTemp++];
        },
        
        buildIbid: function (tempIndex) {
          return temps[tempIndex];
        }
        
      }; // end builder
    }
    
  }); // end deJavaScriptKit
})();

// exports
({
  "deJavaScriptKit": deJavaScriptKit,
  "deJSONTreeKit": deJSONTreeKit,
  "deSubgraphKit": deSubgraphKit
});