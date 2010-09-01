"use cajita";
// Copyright 2007-2009 Kevin Reid under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

var AnswerPos = parameterTypes.AnswerPos;
var ExportPos = parameterTypes.ExportPos;
var ImportPos = parameterTypes.ImportPos;
var IncomingPos = parameterTypes.IncomingPos;
var MsgCount = parameterTypes.MsgCount;
var MsgName = parameterTypes.MsgName;
var WireDelta = parameterTypes.WireDelta;


//:var map as DeepFrozen {
//  to v(f, coll) {
//    return accum [] for v in coll {_.with(f(v))}}
//  to kv(f, coll) {
//    return accum [] for k => v in coll {_.with(f(k, v))}}
//}

// Ensure that an array-like object has no strange behavior by copying it
function plainArray(arrayoid) {
  if (!cajita.isArray(arrayoid)) {
    throw new Error("Wanted array, not: " + arrayoid);
  }
  // If the object is an Array per Cajita then cajita.copy will copy indexes and not other properties
  return cajita.freeze(cajita.copy(arrayoid));
}

cajita.enforceType(NonceLocator, "function");

function amplify(unsealer, ref) {
  var amplifyRefBox = Ref.optSealedDispatch(unsealer, ref);
  if (amplifyRefBox !== null) {
    return unsealer(amplifyRefBox);
  }
}

var DESCS_EXIT = "CapTP_1_descs";

var DelayedRedirector = "makeDelayedRedirector stub";
var Brand = "makeBrand stub";

var Vine = "makeVine stub";

var descMakerStandin = cajita.freeze({}); // XXX establish criteria for Selfish-compared objects and make sure this is one

function CapTPConnection(outgoingReceiver, swissTable, locatorUnum, whenGarbage, hub, localVatID, remoteSearchPath, remoteVatID) {
  var answers = new AnswersTable();
  var exports = new ExportsTable();
  var imports = new ProxiesTable();
  var questions = new ProxiesTable();
  
  var promiseGifts = new PromiseGiftTable(whenGarbage, nonceLocator);
  var nearGifts = new NearGiftTable(whenGarbage);
  var nonceLocator = new NonceLocator(
    promiseGifts,
    nearGifts,
    remoteVatID,
    hub,
    swissTable);
  
  var terminationPair = Ref.promise(); // resolved when connection is dead

  var remoteNonceLocatorRecord; // will be set later

  // Currently unused.
  var currentIncomingSerialNumber = 0;
  
  var prepareQuestion = "<not yet defined>";
  
  var remoteIncomingPosSealPair =
    cajita.makeSealerUnsealerPair(); // ...("CapTP far ref's remote incomingPos")
  var remoteIncomingPosUnsealer = remoteIncomingPosSealPair.unseal
  //var remoteIncomingPosBrand = XXX no brands

  var envWithoutDescs = (function () {
    var s = cajita.copy(defaultEnv);
    s["Ref"] = Ref;
    s["CapTP_1_locatorUnum"] = locatorUnum;
    s["CapTP_JS1_Swiss"] = Swiss;
    return cajita.freeze(s);
  })();
  
  var unenv = (function () {
    var u = CycleBreaker.byInverting(envWithoutDescs).copy();
    u.set(descMakerStandin, DESCS_EXIT);
    return u.freeze();
  })();
  
  /** Uncalls our local NonceLocator being passed out. */
  var nonceLocatorUncaller = cajita.freeze({
    optUncall: function (ref) {
      if (Ref.sameYet(ref, nonceLocator)) {
        return [descMakerStandin, "Import", [0]];
      }
      return null;
    }
  });
  
  var pbcUncaller = cajita.freeze({
    optUncall: function (r) {
      if (Ref.isPBC(r)) {
        if ("CapTP__optUncall" in r) {
          return r.CapTP__optUncall(); // XXX caja-captp review: optUncall protocol?
        } else if (cajita.isRecord(r)) {
          return recordUncaller.optUncall(r);
        } else {
          return null;
        }
      }
      return null;
    }
  });
  
  /** Uncalls Far refs that are being passed to their home vat. */
  var goingHomeUncaller = cajita.freeze({
    optUncall: function (ref) {
      var amp = amplify(remoteIncomingPosUnsealer, ref);
      if (amp) {
        var proxy = amp[0];
        var pos = amp[1];
        pos = IncomingPosT.coerce(pos);
        if (!(Ref.sameYet(proxy, ref))) {
          return [__identityFunc, "run", [Ref.broken("impersonated going-home proxy")]];
        } else {
          return [descMakerStandin, "Incoming", [pos]];
        }
      }
      return null;
    }
  });
  
  var proxyUncaller = cajita.freeze({
    optUncall: function (r) {
      // XXX implement Ref.isPassByProxy?
      if (!Ref.isPassByCopy(r)) {
        //traceln(`exporting $r`)
        var index = exports.indexFor(r);
        if (index !== undefined) {
          exports.incr(index);
          return [descMakerStandin, "Import", [index]];
        } else {
          var swissNumber = swissTable.getNewSwiss(r);
          return [descMakerStandin, "NewFar", [exports.newFarPos(r), swissNumber.hash()]];
        }
      }
      return null;
    }
  });
  
  /** Uncalls promises, assuming that they are either local or from a foreign comm system; that is, they are not subject to 3-vat introduction. */
  var genericPromiseUncaller = cajita.freeze({
    optUncall: function (r) {
      if (Ref.isEventual(r) && !Ref.isResolved(r)) {
        var rdrSwissBase = swissTable.nextSwiss();
        var qTuple = prepareQuestion(true);
        var rdrAnswerPos = qTuple[0];
        var rdrRecord = qTuple[1];
        // XXX we're not using rdrSwissBase for anything; it *should* be extractible from the question proxy so that we can pass it to another vat

        Ref.sendOnly(r, WhenMoreResolvedMessage, [rdrRecord.localReference()]); // XXX caja-captp: define Miranda protocol
        return [descMakerStandin, "NewRemotePromise", [
                 exports.bind(r),
                 rdrAnswerPos,
                 rdrSwissBase]];
      }
      return null;
    }
  });
  
  /** Uncalls promises that are part of another CapTP connection of this hub. */
  var otherConnPromiseUncaller = cajita.freeze({
    optUncall: function (r) {
      if (Ref.isEventual(r) /* && !Ref.isResolved(r) -- XXX disabled until Far3Desc works */) {
        var descArgs = hub.amplifyFor3Desc(r, remoteVatID);
        if (descArgs != null) {
          // XXX type check: Tuple[List[String], String, int, any].enforce(descArgs);
          return [descMakerStandin, "Promise3", descArgs];
        }
      }
      return null;
    }
  });
  
  // XXX document exit table used
  var encRecognizer = deSubgraphKit.makeRecognizer(
    [goingHomeUncaller,
     nonceLocatorUncaller,
     otherConnPromiseUncaller,
     genericPromiseUncaller,
     builtinsUncaller,
     pbcUncaller,
     proxyUncaller],
    unenv);
  
  /** given an index from an incoming message, look up the corresponding local object */
  function lookupIncoming(index) {
    index = IncomingPosT.coerce(index);
    if (index === 0) {
      return nonceLocator;
    } else if (index < 0) {
      return answers.get(-index);
    } else { // above zero
      return exports.get(index);
    }
  }

  function lookupImport(index) {
    index = ImportPosT.coerce(index);
    if (index === 0) {
      return remoteNonceLocatorRecord.receivedReference();
    } else if (index < 0) {
      throw new Error("can't happen: <0 import");
    } else { // above zero
      return imports.get(index).receivedReference();
    }
  }

  /** Transform a CapTP message argument object into the form for the outgoing receiver to accept. */
  function outEncode(object) {
    return once(function (builder) { return encRecognizer.recognize(object, builder); });
  }
  
  function requireLive() {
    if (Ref.isResolved(terminationPair["promise"])) {
      throw new Error("this CapTP connection has been terminated (" + Ref.optProblem(termination) + ")");
    }
  }
  
  function checkedAndAboutToHandleIncoming() {
    requireLive();
    currentIncomingSerialNumber++;
  }
  
  function isProxyForOtherConnection(ref) {
    return amplify(remoteIncomingPosUnsealer, ref) === null && hub.isOurProxy(ref);
  }
  
  function ProxyRecord(far, position) {
    position = IncomingPosT.coerce(position);
    var wireCount = 0; // number of mentions in incoming messages
    var localCount = 0; // number of local proxies with finalizers
    var fresh = true; // have any messages been sent on this ref?
    var resolutionPair = Ref.promise();
    var resolutionTuple = resolutionPair["promise"];
    var proxySlotResolver = resolutionPair["resolver"];

    var proxyRecord;
    
    /** for compatibility with the classic Redirector implementations - XXX review whether this facet and interface are appropriate */
    var proxyResolver = cajita.freeze({
      getProxy: function () { return proxyRecord.localReference(); },
      
      // XXX caja-captp: review what the Proxy protocol is, given that we have no strong sameness/determinism guarantees
      resolve: function (resolution) { proxySlotResolver.resolve(caja.freeze([resolution])); },
      smash: function (problem) { proxySlotResolver.resolveRace(cajita.freeze([Ref.broken(problem)])); },
      optHandler: function () {
        throw new Error("XXX optHandler invoked: review and replace");
        //if (!proxySlotResolver.isDone()) {
        //  return var stubProxyHandler {
        //    to isFresh() { return fresh }
        //    to sameConnection(otherRef) {
        //      return amplify(remoteIncomingPosUnsealer, otherRef) =~ [_]
        //    }
        //  }
        //}
      }
    });
    
    var capTPEventualHandler = cajita.freeze({
      handleSend: function (verb, args) {
        cajita.enforceType(verb, "string");
        console.log("CapTP proxy #" + position + " got send " + verb + "(" + args + ")");
        args = plainArray(args);
        if (verb === WhenMoreResolvedMessage && args.length === 1) {
          capTPEventualHandler.handleSendOnly(verb, args);
          return null;
        } else {
          var tuple = prepareQuestion(false);
          var answerPos = tuple[0];
          var questionRecord = tuple[1];
          
          var redirector = questionRecord.makeRedirector();
          
          fresh = false;
          Ref.sendOnly(outgoingReceiver, "Deliver", [answerPos, outEncode(redirector), position, verb, outEncode(args)]);
          
          return questionRecord.localReference();
        }
      },
      handleSendOnly: function (verb, args) {
        //traceln(`sendOnly $verb $args`)
        console.log("CapTP proxy #" + position + " got sendOnly " + verb + "(" + args + ")");
        cajita.enforceType(verb, "string");
        var reactor = args[0];
        if (verb == WhenMoreResolvedMessage && args.length === 1 \
            && isProxyForOtherConnection(reactor)) {
          console.log("CapTP proxy about to reply with WMR handling");
          Ref.sendOnly(reactor, "run", [proxyRecord.localReference()]);
          return undefined;
        } else {
          console.log("CapTP proxy about to perform DeliverOnly to " + outgoingReceiver);
          fresh = false;
          Ref.sendOnly(outgoingReceiver, "DeliverOnly", [position, verb, outEncode(args)]);
          console.log("CapTP proxy performed DeliverOnly");
        }
      },
      handleOptSealedDispatch: function (brand) {
        if (brand === remoteIncomingPosBrand) {
          console.log(Ref.sameYet(proxyRecord.localReference(), proxyRecord.localReference())); // XXX remove
          return remoteIncomingPosSealer([proxyRecord.localReference(), position]);
        } else if (brand === hub.get3DescBrand()) {
          return hub.get3DescSealer().seal(function (recipID) {
            var nonce = swissTable.nextSwiss();
            // XXX we shouldn't have the authority to specify the path+vatID - it should be baked into our access to the hub
            var farVine = Ref.send(remoteNonceLocatorRecord.localReference(), "provideFor", [
              /*incomingDescStub*/ cajita.freeze({CapTP__optUncall: function () { return [descMakerStandin, "Incoming", [position]]; }}),
              recipID,
              nonce]);
            return [remoteSearchPath, remoteVatID, nonce, makeVine(farVine)];
          });
        } else {
          return null;
        }
      },
      
      toString: function () {
        return "[CapTP proxy handler for " + position + " of " + outgoingReceiver + "]";
      }
    });
    
    proxyRecord = cajita.freeze({
      smash: function (problem) {
        proxyResolver.smash(problem);
      },
      
      makeRedirector: function () {
        return makeDelayedRedirector(proxyResolver);
      },

      /** make a local reference, and increment the wireCount (number of received descriptors for this local entry) */
      receivedReference: function () {
        wireCount += 1;
        return proxyRecord.localReference();
      },

      localReference: function () {
        var proxy = Ref.Proxy(capTPEventualHandler, resolutionTuple, far);
        localCount += 1;
        
        whenGarbage(proxy, once(function () {
          localCount -= 1;
          if (localCount.atMostZero()) {
            if (position.belowZero()) {
              // question
              Ref.sendOnly(outgoingReceiver, "GCAnswer", [position]);
              questions.free(-position);
            } else if (position.aboveZero()) {
              // import
              Ref.sendOnly(outgoingReceiver, "GCExport", [position, wireCount]);
              // no imports.free(...) because the other side might reuse this entry
            }
            wireCount = 0;
          }
        }));
        return proxy;
      }
    });
    
    return proxyRecord;
  }
  
  // The remote nonce locator is a Far reference which is unique to this connection -- XXX this representation will have to be changed for ShutdownOp; see connection.updoc
  remoteNonceLocatorRecord = ProxyRecord(true, 0);
  
  prepareQuestion = function (resolved) {
    var recordPPair = Ref.promise();
    var position = -(questions.bind(recordPPair["promise"]));
    var record = ProxyRecord(resolved, position);
    recordPPair["resolver"].resolve(record);
    return [position, record];
  };
  
  var incomingDescMaker = cajita.freeze({
    NewFar: function (importPos, swissHash) {
      importPos = ImportPosT.coerce(importPos);
      swissHash = Swiss.T.coerce(swissHash);
      requireLive();

      imports.set(importPos, ProxyRecord(true, importPos));
      
      return imports.get(importPos).receivedReference();
    },
    
    NewRemotePromise: function (importPos, rdrPos, rdrBase) {
      importPos = ImportPosT.coerce(importPos);
      rdrPos = AnswerPosT.coerce(rdrPos);
      rdrBase = Swiss.T.coerce(rdrBase);
      requireLive();
      
      var record = ProxyRecord(false, importPos);
      imports.set(importPos, record);
      
      (function () {
        var redirector = record.makeRedirector();
        swissTable.registerIdentity(redirector, rdrBase);
        answers.set(-rdrPos, redirector, true);
      })();
      
      return record.receivedReference();
    },
    
    Import: function (importPos) {
      importPos = ImportPosT.coerce(importPos);
      requireLive();
      return lookupImport(importPos);
    },

    Incoming: function (incomingPos) {
      incomingPos = IncomingPosT.coerce(incomingPos);
      requireLive();
      return lookupIncoming(incomingPos);
    },
    
    Promise3: function (searchPath, hostID, nonce, vine) {
      searchPath = SearchPathT.coerce(searchPath);
      hostID = VatIDT.coerce(hostID);
      nonce = NonceT.coerce(nonce);
      vine = VineT.coerce(vine);
      // XXX how does this succeed in waiting long enough?
      return Ref.send(Ref.send(hub.get(searchPath, hostID), "nonceLocator", []),
                      "acceptFrom",
                      [remoteSearchPath, remoteVatID, nonce, new Vine(vine)]);
    }
  });
  
  var buildEnv = cajita.copy(envWithoutDescs);
  buildEnv[DESCS_EXIT] = incomingDescMaker;
  cajita.freeze(buildEnv);
  
  /** Turns an incoming encoded-object (a closure over some Data-E recognizer) into a local object by providing it with a builder. */    
  function inObj(specimen) {
    // XXX All this would be better done by a Data-E protocol verifier intermediary -- and we ought to be hiding the builder products from the provided recognizer, anyway.
    var builderDead = false;
    var baseBuilder = deSubgraphKit.makeBuilder(buildEnv);
    var capTPArgBuilder = {};
    cajita.forOwnKeys(baseBuilder, function (key) {
      var methd = baseBuilder[key];
      capTPArgBuilder[key] = function () {
        requireLive();
        if (builderDead) {
          throw new Error("this CapTP argument builder is no longer valid");
        }
        return methd.apply(baseBuilder, arguments);
      };
    });
    cajita.freeze(capTPArgBuilder);
    try {
      return specimen(capTPArgBuilder);
    } finally { 
      builderDead = true;
    }
  }
  
  var capTPReceiver = cajita.freeze({
    toString: function () { return '[CapTP receiver]'; },

    DeliverOnly: function (recipPos, verb, argsEnc) {
      recipPos = IncomingPosT.coerce(recipPos);
      verb = MsgNameT.coerce(verb);
      var args = plainArray(inObj(argsEnc));
      
      checkedAndAboutToHandleIncoming();
      Ref.sendOnly(lookupIncoming(recipPos), verb, args);
    },

    Deliver: function (answerPos, rdrEnc, recipPos, verb, argsEnc) {
      answerPos = AnswerPosT.coerce(answerPos);
      var rdr = inObj(rdrEnc);
      recipPos = IncomingPosT.coerce(recipPos);
      cajita.enforceType(verb, "string");
      var args = plainArray(inObj(argsEnc));
      
      checkedAndAboutToHandleIncoming();
      var answer = Ref.send(lookupIncoming(recipPos), verb, args);
      answers.set(-answerPos, answer, true);
      Ref.sendOnly(answer, WhenMoreResolvedMessage, [rdr]);
    },
    
    GCExport: function (exportPos, wireDelta) {
      exportPos = ExportPosT.coerce(exportPos);
      wireDelta = WireDeltaT.coerce(wireDelta);
      
      checkedAndAboutToHandleIncoming();
      exports.decr(exportPos, wireDelta);
      // XXX do we need to do something upon reaching 0?
    },
    
    GCAnswer: function (answerPos) {
      answerPos = AnswerPosT.coerce(answerPos);
      checkedAndAboutToHandleIncoming();
      answers.free(-answerPos);
    },

    Terminated: function (problemEnc) {
      var problem = inObj(problemEnc);
      // XXX enforce is an error
      
      checkedAndAboutToHandleIncoming();
      
      terminationPair["resolver"].smash(problem);
      
      // Discard our local references, break our proxies
      exports.smash(problem);
      imports.smash(problem);
      answers.smash(problem);
      questions.smash(problem);
      remoteNonceLocatorRecord.smash(problem);
      
      // Discard our outgoing references, since we will no longer use them
      outgoingReceiver = null;
      // XXX review for additional cleanup needed/useful
    }
  });
  
  /** Facet of this connection provided for the LocatorUnum etc. */
  var outgoingConnection = cajita.freeze({
    toString: function () { return '[CapTP outgoing to ' + remoteVatID + ']'; },
    nonceLocator: function () { return remoteNonceLocatorRecord.localReference(); }
  });
  
  // XXX review what the least authority is for this
  /** Facet of this connection provided for its peer connections, to manage 3-vat introductions. */
  var peerConnection = cajita.freeze({
    toString: function () { return '[CapTP peer to ' + remoteVatID + ']'; },
    nonceLocator: function () { return remoteNonceLocatorRecord.localReference(); },
    getPromiseGiftTable: function () { return promiseGifts; },
    getNearGiftTable: function () { return nearGifts; }
  });

  return cajita.freeze([capTPReceiver, outgoingConnection, peerConnection]);
}

// exports
cajita.freeze({
"CapTPConnection": CapTPConnection
});