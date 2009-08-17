"use strict,cajita";
// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

function mapF(func, array) {
  var out = [];
  for (var i = 0; i < array.length; i++) {
    out[i] = func(array[i]);
  }
  return cajita.freeze(out);
}

// This performs the same algorithm as deASTKit from E-on-Java, with only difference in the output.
var deJSONTreeKit = (function () {
  function jsonAtomType(x) {
    return typeof(x) === "string" || typeof(x) === "number";
  }
  
  return cajita.freeze({
    toString: function () { return "deJSONTreeKit"; },
    makeBuilder: function () {
      var nextTemp = 0;
      var varReused = [];
      return cajita.freeze({
        toString: function () { return "<deJSONTreeKit builder>"; },
        
        buildRoot: function (node) {
          nextTemp = null; // help discourage accidental reuse
          
          function simplify(x) {
            var tag = cajita.isArray(x) ? x[0] : "atom";
            switch (tag) {
              case "atom": 
              case "ibid":
              case "import":
                return x;
              case "define":
                if (!varReused[x[1]]) return simplify(x[2]);
                // fallthrough
              case "defrec":
                return cajita.freeze([tag, x[1], simplify(x[2])]);
              case "call":
                return cajita.freeze(["call", simplify(x[1]), x[2], mapF(simplify, x[3])]);
              default:
                throw new Error("deJSONTreeKit: Unrecognized tag in simplifier: " + tag);
            }
          }
          
          return simplify(node);
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
          varReused[index] = true;
          return cajita.freeze(["ibid", index]);
        },
        
        buildCall: function (recipient, verb, args) {
          return cajita.freeze(["call", recipient, verb, args]);
        },
        
        buildPromise: function () {
          var promiseIndex = nextTemp;
          nextTemp += 2;
          varReused[promiseIndex] = false;
          varReused[promiseIndex + 1] = false;
          return promiseIndex;
        },
        
        buildDefine: function (rValue) {
          var tempIndex = nextTemp++;
          varReused[tempIndex] = false;
          var defExpr = cajita.freeze(["define", tempIndex, rValue]);
          return cajita.freeze([defExpr, tempIndex]);
        },
        
        buildDefrec: function (resolverIndex, rValue) {
          var promiseIndex = resolverIndex - 1;
          
          // If the variable has been mentioned (by an ibid) *before* defrec (as opposed to after) then the defrec does in fact define a cycle and cannot be simplified to a define.
          if (varReused[promiseIndex])
            return cajita.freeze(["defrec", promiseIndex, rValue]);
          else
            return cajita.freeze(["define", promiseIndex, rValue]);
        }
        
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
        recog_ibid: function (tag, inputTempIndex) {
          return builder.buildIbid(tempMap[inputTempIndex]);
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
        recog_defrec: function (tag, promiseIndex, rValue) {
          var builtPromiseIndex = builder.buildPromise();
          tempMap[promiseIndex] = builtPromiseIndex;
          tempMap[promiseIndex+1] = builtPromiseIndex+1;
          return builder.buildDefrec(builtPromiseIndex+1, subRecog(rValue));
        }
      };
      
      var subRecog = function (jsonValue) {
        if (typeof(jsonValue) === "string" || typeof(jsonValue) === "number") {
          return builder.buildAtom(jsonValue);
        } else if (typeof(jsonValue) == "object") {
          // assuming it's an array
          var handler = handlers["recog_" + jsonValue[0]];
          if (handler)
            return handler.apply(cajita.USELESS, jsonValue);
          else
            throw new Error("deJSONTreeKit: Unrecognized tag '"+ jsonValue[0] + "' in input: " + jsonValue);
        } else {
          // XXX test for handling this case
        }
      };
      
      return builder.buildRoot(subRecog(specimen));
    }

  }); // end deJSONTreeKit
})();

var deSubgraphKit = (function () {

  function isRecognizeAtom(obj) {
    var t = typeof(obj);
    return t==="number" || t==="string" || t==="undefined" || t==="boolean" || obj===null;
  }

  function subgraphAtomType(x) {
    return true;
  }
  
  return cajita.freeze({

    toString: function () { return "deSubgraphKit"; },
    
    // The uncallers and unenv makeRecognizer uses by default.
    getDefaultEnv: function () { return defaultEnv; },
    getDefaultUnenv: function () { return defaultUnenv; },
    getDefaultUncallers: function () { return defaultUncallers; },

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

        buildIbid: function (tempIndex) {
          return temps[tempIndex];
        },
        
        buildCall: function (rec, verb, args) { return rec[verb].apply(rec, args); },
        
        buildDefine: function (definition) {
          temps[nextTemp++] = definition;
          return [definition, nextTemp - 1];
        },
        
        buildPromise: function () {
          var pr = Ref.promise();
          temps[nextTemp++] = pr.promise;
          temps[nextTemp++] = pr.resolver;
          return nextTemp - 2;
        },
        
        buildDefrec: function (resolverIndex, definition) {
          temps[resolverIndex].resolve(definition);
          return definition;
        }
        
      }; // end builder
    },
    
    makeRecognizer: function (uncallers, unenv) {
      if (uncallers === undefined) {
        uncallers = defaultUncallers;
      }
      if (unenv === undefined) {
        unenv = defaultUnenv;
      }
      return cajita.freeze({
        toString: function () { return "<deSubgraphKit recognizer>"; },
        
        recognize: function (specimen, builder) {
          cajita.enforceType(builder, "object", "deSubgraphKit.recognize's builder");
          
          var atomType = builder.atomType();
          
          var seen = cajita.newTable(false);
          
          // subRecog is the recursive processor of a single object being serialized.
          var subRecog = function (obj, stack) {
            var nstack = stack.concat([obj]); // for debug tracing
            obj = Ref.resolution(obj);
            
            // There are several possible results from serializing an object, indicated below:
            
            var unenvLookup = unenv.get(obj);
            var seenLookup = seen.get(obj);
            if (unenvLookup !== undefined) {
              // *** The object is an exit.
              
              // XXX using undefined here because that's what a cajita.newTable() returns for misses -- should we do otherwise, eg using null? -- kpreid 2009-05-31
              //cajita.enforceType(unenvLookup, "string") // not yet tested
              return builder.buildImport(unenvLookup);
            } else if (seenLookup !== undefined) {
              // *** The object has been seen before.
              return builder.buildIbid(seenLookup);
            } else {
              // *** The object has not been seen before; we must record it for potential cycles or reoccurrences.
              var promIndex = builder.buildPromise();
              seen.set(obj, promIndex);
              
              var node; // Will hold the Data-E portrayal of the object
              if (isRecognizeAtom(obj) && atomType(obj)) {
                // *** The object is an atom.
                node = builder.buildAtom(obj);
              } else {
                // *** The object is composite (gets uncalled).
                for (var i = 0; i < uncallers.length; i++) {
                  // An uncaller returns either a 3-tuple or null.
                  var optPortrayal = uncallers[i].optUncall(obj);
                  if (optPortrayal === undefined) {
                    console.error("", uncallers[i], " returned undefined (not null) for object ", obj, "."); // don't throw secrets
                    throw new Error("An uncaller returned undefined (not null).");
                  }
                  if (optPortrayal !== null) {
                    var recipBuilt = subRecog(optPortrayal[0], nstack);
                    var argsObjs = optPortrayal[2];
                    var argsBuilt = [];
                    for (var j = 0; j < argsObjs.length; j++) {
                      argsBuilt[j] = subRecog(argsObjs[j], nstack);
                    }
                    node = builder.buildCall(recipBuilt, optPortrayal[1], cajita.freeze(argsBuilt));
                    break;
                  }
                }

                // *** The object is not serializable.
                if (!node) {
                  var report = ["deSubgraphKit: can't uneval ", obj];
                  for (var i = stack.length - 1; i >= 0; i--) {
                    report.push("\n  ...in portrayal of "); report.push(stack[i]);
                  }
                  report.push("\n...which is the root.");
                  console.error.apply(console, report);
                  throw new Error("deSubgraphKit: can't uneval object"); // don't throw secrets
                }
              }

              // At this point, 'node' has been filled in with the representation of the object.
              return builder.buildDefrec(promIndex + 1, node);
            }
          }; // end subRecog
          
          return builder.buildRoot(subRecog(specimen, []));
        }
      }); // end recognizer
    }
    
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
          // Note that these substitutions is only sound under certain assumptions about the environment... Should be parameterizable, at least to turn them off.
          if (rec === "DataE_JS1_builtinsMaker" && verb === "frozenArray") {
            return "cajita.freeze([" + args.join(", ") + "])";
          } else if (rec === "cajita" && verb === "readPub" && args.length == 2) {
            return "(" + args[0] + ")[" + args[1] + "]";
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
cajita.freeze({
  deJavaScriptKit: deJavaScriptKit,
  deJSONTreeKit: deJSONTreeKit,
  deSubgraphKit: deSubgraphKit
});