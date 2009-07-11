// Copyright 2007-2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............
"use strict,cajita";

var setTimeout = PRIV_scheduling.setTimeout;

var BROKEN = "BROKEN";
var NEAR = "NEAR";
var EVENTUAL = "EVENTUAL";

// Special field names on objects
var RefBoxProperty = "CapTP__ref";
var WhenMoreResolvedMessage = "CapTP__whenMoreResolved";
var WhenBrokenMessage = "CapTP__whenBroken";

var refSU = cajita.makeSealerUnsealerPair();

function _makeRef(impl, toString) {
  var ref = {
    toString: impl.refToString
  };
  ref[RefBoxProperty] = refSU.seal(impl);
  return cajita.freeze(ref);
}
function getRefImpl(ref) {
  var box = (ref === undefined || ref === null) ? undefined : ref[RefBoxProperty];
  if (box) {
    return refSU.unseal(box);
  } else {
    // This is the Near ref's ref behavior.
    
    // XXX review: avoid this construction on every operation?
    return cajita.freeze({
      isResolved: function () { return true; },
      optProblem: function () {},
      optSealedDispatch: function (brand) { return undefined; },
      send: function (verb, args) {
        var pr = Ref.promise();
        var r = pr.resolver.resolve;
        setTimeout(function () { r(Ref.call(ref, verb, args)); }, 0);
        return pr.promise;
      },
      sendOnly: function (verb, args) {
        setTimeout(function () { Ref.call(ref, verb, args); }, 0);
      },
      shorten: function () { return ref; },
      state: function () { return NEAR; }
    });
  }
}

function coerceToError(x) {
  if (x === undefined) {
    throw new Error("May not use undefined as an error");
  } else if (typeof(x) === "string") {
    return new Error(x);
  } else {
    return x;
  }
}

var Ref = cajita.freeze({
  toString: function () {
    return "[Caja-CapTP Ref]";
  },
  
  /** Return a broken reference with the specified problem.
      
      http://wiki.erights.org/wiki/Object_Ref#broken.2F1
      
      In this JavaScript adaptation, a problem may be anything but undefined, since undefined is reserved for not-broken. */
  broken: function (problem) {
    problem = coerceToError(problem);
    var ref;
    var refImpl = {
      isResolved: function () { return true; },
      optProblem: function () { return problem; },
      optSealedDispatch: function (brand) { return undefined; },
      refToString: function () { return "[Broken: " + problem + "]"; },
      send: function (verb, args) {
        if (verb === WhenMoreResolvedMessage && args.length == 1) {
          Ref.sendOnly(args[0], "call", [cajita.USELESS, ref]);
        } else if (verb === WhenBrokenMessage && args.length == 1) {
          Ref.sendOnly(args[0], "call", [cajita.USELESS, ref]);
        }
        return ref;
      },
      sendOnly: function (verb, args) {
        refImpl.send(verb, args);
      },
      shorten: function () { return ref; },
      state: function () { return BROKEN; }
    };
    ref = cajita.copy(_makeRef(refImpl));
    ref[WhenMoreResolvedMessage] = ref[WhenBrokenMessage] = function (reactor) {
      Ref.send(reactor, "call", [cajita.USELESS, ref]);
      throw problem; // XXX review: is rethrowing problematic? What about mutability of the error, stack traces, etc?
    };
    return cajita.freeze(ref);
  },
  
  /** http://wiki.erights.org/wiki/Proxy
      For JavaScript idiom, the second argument is a promise for, not a slot object (which type does not exist), but a 1-element array. */
  Proxy: function (handler, resolutionBox, isFar) {
    var ref;
    var proxyImpl = cajita.freeze({
      isResolved: function () { return isFar; }, // XXX stub
      optProblem: function () { return undefined; }, // XXX stub
      optSealedDispatch: function (brand) { return handler.handleOptSealedDispatch(brand); },
      refToString: function () {
        return isFar ? "[Far ref]" : "[Promise]"; // XXX handle resolution
      },
      send: function (verb, args) {
        return Ref.send(handler, "handleSend", cajita.freeze([verb, args]));
      },
      sendOnly: function (verb, args) {
        Ref.sendOnly(handler, "handleSendOnly", cajita.freeze([verb, args]));
      },
      shorten: function () { return ref; }, // XXX stub
      state: function () { return EVENTUAL; }
    });
    ref = _makeRef(proxyImpl);
    return ref;
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#promise.2F0
      For JavaScript idiom, returns a record with promise and resolver keys rather than a tuple. */
  promise: function () {
    var resolved = false;
    var resolution;
    var promise;
    var buffer = [];

    var refImpl = cajita.freeze({
      isResolved: function () { return resolved ? getRefImpl(resolution).isResolved() : false; },
      optProblem: function () { return resolved ? getRefImpl(resolution).optProblem() : undefined; },
      optSealedDispatch: function (brand) { return resolved ? getRefImpl(resolution).optSealedDispatch(brand) : undefined; },
      refToString: function () { return resolved ? getRefImpl(resolution).refToString() : "[Promise]"; },
      send: function (verb, args) {
        var resultRP = Ref.promise();
        buffer.push({resolver: resultRP.resolver, verb: verb, args: args});
        return resultRP.promise;
      },
      sendOnly: function (verb, args) {
        buffer.push({resolver: null, verb: verb, args: args});
      },
      shorten: function () { return resolved ? getRefImpl(resolution).shorten() : promise; },
      state: function () { return resolved ? getRefImpl(resolution).state() : EVENTUAL; }
    });
    promise = _makeRef(refImpl);
    
    var resolver = {
      toString: function () { return resolved ? "[Closed Resolver]" : "[Resolver]"; },
      isDone: function () { return resolved; },
      refToString: function () { 
        if (resolved) {
          return "[Caja-CapTP ref:]" + resolution;
        } else {
          return "[Caja-CapTP promise]";
        }
      },
      resolve: function (ref) {
        if (!resolver.resolveRace(ref)) {
          throw new Error("this resolver's ref has already been resolved, therefore cannot be resolved");      
        }
      },
      smash: function (problem) {
        if (!resolver.resolveRace(Ref.broken(problem))) {
          throw new Error("this resolver's ref has already been resolved, therefore cannot be smashed");      
        }
      },
      resolveRace: function (ref) {
        if (resolved) {
          return false;
        } else {
          resolution = ref;
          resolved = true;
          return true;
        }
        for (var i = 0; i < buffer.length; i++) {
          var queued = buffer[i];
          if (queued.resolver == null) {
            Ref.send(resolution, queued.verb, queued.args);
          } else {
            queued.resolver.resolve(Ref.send(resolution, queued.verb, queued.args));
          }
        }
      }
    };
    cajita.freeze(resolver);
    
    return cajita.freeze({
      promise: promise,
      resolver: resolver
    });
  },

  /** http://wiki.erights.org/wiki/Object_Ref#resolution.2F1 */
  resolution: function (ref) {
    return getRefImpl(ref).shorten();
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#fulfillment.2F1 */
  fulfillment: function (ref, optWhy) {
    ref = getRefImpl(ref).shorten();
    var i = getRefImpl(ref);
    if (i.isResolved()) {
      var p = i.optProblem();
      if (p === undefined) {
        return ref;
      } else {
        throw p;
      }
    } else {
      throw new Error("Ref.fulfillment: unresolved reference" + (optWhy ? " (" + optWhy + ")" : ""));
    }
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#state.2F1 */
  state: function (ref) {
    return getRefImpl(ref).state();
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#optProblem.2F1 */
  optProblem: function (ref) {
    return getRefImpl(ref).optProblem();
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#optProblem.2F1 */
  isBroken: function (ref) {
    return getRefImpl(ref).optProblem() !== undefined;
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#isEventual.2F1 */
  isEventual: function (ref) { 
    return getRefImpl(ref).state() === EVENTUAL;
  },

  /** http://wiki.erights.org/wiki/Object_Ref#isNear.2F1 */
  isNear: function (ref) { 
    var i = getRefImpl(ref);
    return i.isResolved() && i.state() === NEAR;
  },

  /** http://wiki.erights.org/wiki/Object_Ref#isFar.2F1 */
  isFar: function (ref) { 
    var i = getRefImpl(ref);
    return i.isResolved() && i.state() === EVENTUAL;
  },

  /** http://wiki.erights.org/wiki/Object_Ref#isResolved.2F1 */
  isResolved: function (ref) { 
    return getRefImpl(ref).isResolved();
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#isSettled.2F1 */
  isSettled: function (ref) {
    // XXX isSettled,isSelfish need revision once we have passbycopy objects (if we do at all).
    return getRefImpl(ref).isResolved();
  },

  /** http://wiki.erights.org/wiki/Object_Ref#isSelfish.2F1 */
  isSelfish: function (ref) {
    // XXX isSettled,isSelfish need revision once we have passbycopy objects (if we do at all).
    var t = typeof(ref);
    // XXX this defn. should come from elsewhere, match up with Data-E
    return !(t==="number" || t==="string" || t==="undefined" || t==="boolean" || ref===null);
  },
  
  call: function (ref, verb, args) {
    ref = Ref.resolution(ref);
    if (Ref.isNear(ref)) {
      return cajita.callPub(ref, verb, args);
    } else {
      throw new Error("Ref.call: not near (" + verb + "/" + args.length + ")");
    }
  },
  
  send: function (ref, verb, args) {
    return getRefImpl(ref).send(verb, args);
  },
  
  sendOnly: function (ref, verb, args) {
    getRefImpl(ref).sendOnly(verb, args);
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#optSealedDispatch.2F2 */
  optSealedDispatch: function (ref, brand) {
    // XXX review: We don't have Brands as in E, so this interface needs revision...
    return getRefImpl(ref).optSealedDispatch(brand);
  },
  
  /** http://wiki.erights.org/wiki/Object_Ref#whenResolved.2F2 */
  whenResolved: function (ref, reactor) {
    var resultPR = Ref.promise();
    console.log("CC whenResolved " + ref + " " + reactor);
    function safeWhenResolvedReactor(unusedRefArg) {
      console.log("CC whenResolved callback " + ref + " " + reactor);
      ref = Ref.resolution(ref);
      if (Ref.isResolved(ref)) {
        console.log("CC whenResolved now resolved");
        if (!resultPR.resolver.isDone()) {
          console.log("CC whenResolved signaling reactor");
          resultPR.resolver.resolve(Ref.send(reactor, "call", cajita.freeze([cajita.USELESS, ref])));
        }
      } else {
        console.log("CC whenResolved still unresolved");
        Ref.sendOnly(ref, WhenMoreResolvedMessage, cajita.freeze([safeWhenResolvedReactor]));
      }
    }
    safeWhenResolvedReactor.toString = function () { return "[SafeWhenResolvedReactor]"; };
    safeWhenResolvedReactor(null);
    return resultPR.promise;
  },

  /** http://wiki.erights.org/wiki/Object_Ref#whenResolvedOnly.2F2 */
  whenResolvedOnly: function (ref, reactor) {
    console.log("CC whenResolvedOnly " + ref + " " + reactor);
    var live = true;
    function safeWhenResolvedReactor(unusedRefArg) {
      console.log("CC whenResolvedOnly " + ref + " " + reactor);
      ref = Ref.resolution(ref);
      if (Ref.isResolved(ref)) {
        console.log("CC whenResolved now resolved");
        if (live) {
          live = false;
          console.log("CC whenResolved signaling reactor");
          Ref.sendOnly(reactor, "call", cajita.freeze([cajita.USELESS, ref]));
        }
      } else {
        console.log("CC whenResolved still unresolved");
        Ref.sendOnly(ref, WhenMoreResolvedMessage, cajita.freeze([safeWhenResolvedReactor]));
      }
    }
    safeWhenResolvedReactor.toString = function () { return "[SafeWhenResolvedReactor]"; };
    safeWhenResolvedReactor(null);
  }
});

cajita.freeze({
  "Ref": Ref
});