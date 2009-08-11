"use strict,cajita";
// Copyright 2003 Hewlett Packard, Inc. under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ................

// Imports: deSubgraphKit, deJSONTreeKit, deJavaScriptKit

// Used by beForgiving. Not translated because we're using JS objects for envs right now.
///**
// * Makes a map like the argument, but which returns a broken reference rather
// * than throwing an exception on an <tt>m[key]</tt> when the key is not
// * found.
// */
//function makeForgivingMap(map) :near {
//    var forgivingMap extends map {
//        to get(key) :any {
//            if (super.maps(key)) {
//                return super[key]
//            } else {
//                return Ref.broken(`There is no $key`)
//            }
//        }
//        to snapshot() :near { return makeForgivingMap(super.snapshot()) }
//        to copy()     :near { return makeForgivingMap(super.copy()) }
//        to readOnly() :near { return makeForgivingMap(super.readOnly()) }
//    }
//    return forgivingMap
//}

function extend(superobj, extension) {
    var combined = cajita.copy(superobj);
    cajita.forOwnKeys(extension, function (key) { combined[key] = extension[key]; });
    return cajita.freeze(combined);
}

function forValues(collection, func) {
    cajita.forOwnKeys(collection, function (key) { func(collection[key]); });
}
  
/**
 * @param uncallers An array.
 *                  Defaults to deSubgraphKit.getDefaultUncallers().
 *                  The search path used to find a portrayal for
 *                  traversing each node of the subgraph.
 * @param unenv A CycleBreaker or similar map.
 *              Defaults to deSubgraphKit.getDefaultUnenv().
 *              Cuts off outgoing references, replacing them with
 *              named exit points to be reconnected.
 * @param depictionBuilderMaker Defaults to deJSONTreeKit.
 *                              Used to make the builder which will make
 *                              the depiction.
 * @param optPrefix Defaults to null. If non-null, then the
 *                  optDepictionBuilderMaker and optDepictionRecognizer
 *                  must be for depictions which are strings.
 *                  If provided, then it is prepended to the depiction to
 *                  create the serialized form, and is stripped from the
 *                  beginning of the depiction prior to serialization.
 * @param depictionRecognizer Defaults to deJSONTreeKit.
 *                            Used to recognize the depiction built
 *                            according to optDepictionBuilderMaker.
 * @param env An object used as environment.
 *            Defaults to deSubgraphKit.getDefaultEnv().
 *            Used to reconnect the named exit points.
 * @param caller Defaults to Ref.
 *               Used to perform a Data-E call expression during
 *               unserialization.
 * 
 * @author Kevin Reid, after Mark S. Miller's E code from E-on-Java
 */
function Surgeon(params) {
    if (params === undefined) params = {};

    var uncallers = "uncallers" in params ? params.uncallers : deSubgraphKit.getDefaultUncallers();
    cajita.enforce(cajita.isArray(uncallers));
    var unenv = "unenv" in params ? params.unenv : deSubgraphKit.getDefaultUnenv();
    var depictionBuilderMaker = "depictionBuilderMaker" in params ? params.depictionBuilderMaker : deJSONTreeKit;

    var optPrefix = "optPrefix" in params ? params.optPrefix : null;
    if (optPrefix !== null) cajita.enforceType(optPrefix, "string");

    var depictionRecognizer = "depictionRecognizer" in params ? params.depictionRecognizer : deJSONTreeKit;
    var env = "env" in params ? params.env : deSubgraphKit.getDefaultEnv();
    cajita.enforce(cajita.isRecord(env));
    var caller = "caller" in params ? params.caller : Ref;
    

    var subgraphRecognizer = deSubgraphKit.makeRecognizer(uncallers,
                                                          unenv);

    var readOnlySurgeon = cajita.freeze({
        toString: function () { return "[readonly Surgeon]"; },
        
        makeDepictionBuilder:   function () { return depictionBuilderMaker.makeBuilder(); },
        getOptPrefix:           function () { return optPrefix; },
        getDepictionRecognizer: function () { return depictionRecognizer; },
        getSubgraphRecognizer:  function () { return subgraphRecognizer; },
        makeSubgraphBuilder:    function () {
            return deSubgraphKit.makeBuilder(cajita.snapshot(env), caller);
        },

        snapshot: function () {
            return Surgeon({uncallers: cajita.snapshot(uncallers),
                            unenv: unenv.snapshot(),
                            depictionBuilderMaker: depictionBuilderMaker,
                            optPrefix: optPrefix,
                            depictionRecognizer: depictionRecognizer,
                            env: cajita.snapshot(env),
                            caller: caller}).readOnly();
        },

        copy: function () { // like E diverge, but Cajita calls it copy
            return Surgeon({uncallers: cajita.copy(uncallers),
                            unenv: unenv.copy(),
                            depictionBuilderMaker: depictionBuilderMaker,
                            optPrefix: optPrefix,
                            depictionRecognizer: depictionRecognizer,
                            env: cajita.copy(env),
                            caller: caller});
        },

        readOnly: function () {
            return readOnlySurgeon;
        },

        serialize: function (root) {
            // In E systems, the deASTKit has incidental functionality of simplifying Data-E  (removing unnecessary define and defrec). In Caja-CapTP, deJSONTreeKit incorporates that functionality; and it is also the commonly used kit. So we use it in the same way, but have a special case to optimize for it.
            var depictionBuilder = readOnlySurgeon.makeDepictionBuilder();
            var depiction;
            if (depictionBuilderMaker === deJSONTreeKit) {
                depiction = subgraphRecognizer.recognize(root, depictionBuilder);
            } else {
                var ast = subgraphRecognizer.recognize(root,
                                                       deJSONTreeKit.makeBuilder());
                depiction = deJSONTreeKit.recognize(ast, depictionBuilder);
            }
            if (null === optPrefix) {
                return depiction;
            } else {
                return optPrefix + depiction;
            }
        },

        unserialize: function (depiction) {
            if (null !== optPrefix) {
                var found = depiction.substr(0, optPrefix.length);
                cajita.enforce(found === optPrefix);
                depiction = depiction.substr(optPrefix.length);
            }
            var subgraphBuilder = readOnlySurgeon.makeSubgraphBuilder();
            return depictionRecognizer.recognize(depiction, subgraphBuilder);
        }
    });

    var surgeon = extend(readOnlySurgeon, {
        toString: function () { return "[Surgeon]"; },

        /**
         * mustBeSettled defaults to false
         */
        addExit: function (value, exitName, optMustBeSettled) {
            cajita.enforceType(exitName, "string");
            if (optMustBeSettled) {
                cajita.enforce(Ref.isSettled(value),
                    "Must be settled: ", value, " => ", exitName);
            }
            unenv.set(value, exitName);
            env[exitName] = value;
        },

        addUncaller: function (uncaller) {
            uncallers.unshift(uncaller);
        },

        addLastUncaller: function (uncaller) {
            uncallers.push(uncaller);
        },

        addLoader: function (loader,
                             exitName,
                             optMustBeSettled) {
            surgeon.addExit(loader, exitName, optMustBeSettled);
            surgeon.addUncaller(loader);
        },

        // XXX disabled because makeForgivingMap is not possible -- to review
        //to beForgiving() :void {
        //    surgeon.addExit(<opaque>, "opaque__uriGetter", true)
        //    // Add at end instead of beginning
        //    surgeon.addLastUncaller(<opaque>)
        //    env = makeForgivingMap(env)
        //}

        /**
         * Names which either aren't found, map to undefined, or aren't settled
         * aren't added.
         */
        addFromEnv: function (otherEnv, exitNames, loaderNames) {
            cajita.enforce(cajita.isArray(exitNames));
            cajita.enforce(cajita.isArray(loaderNames));
            forValues(exitNames, function (name) {
                var value = otherEnv[name];
                if (value !== undefined) {
                    surgeon.addExit(value, name, true);
                } else {
                    console.debug("no exit: ", name);
                }
            });
            forValues(loaderNames, function (name) {
                var value = otherEnv[name];
                if (value !== undefined) {
                    surgeon.addLoader(value, name, true);
                } else {
                    console.debug("no loader: ", name);
                }
            });
        }

        // --- XXX Caja-CapTP: This remains untranslated until we figure out what envs are interesting to users.
        ///**
        // * The defaultEnv / defaultUnenv already has bindings for
        // * "null", "false", "true", "NaN", "Infinity", "__makeList",
        // * "__identityFunc", "__makeInt", and "import__uriGetter", so
        // * addFromSafeEnv() assumes these are already present and does
        // * not add them. Similarly, the defaultUncallers already has the
        // * import__uriGetter, so this is not added as a loader.
        // * <p>
        // * For different reasons, the opaque__uriGetter is not added by
        // * addFromSafeEnv() -- we leave its addition as a separate policy
        // * decision, especially since it needs to be added to the end,
        // * not the beginning, of the uncallers list.
        // */
        //addFromSafeEnv: function () {
        //    surgeon.addFromEnv(safeEnv, [
        //
        //        // Keep the following lists in the same order as in
        //        // ScopeSetup.java, and maintain these lists jointly.
        //
        //        // "null", already in default env / unenv
        //        // "false", already in default env / unenv
        //        // "true", already in default env / unenv
        //        "throw", // A strange but useful thing to include, so a
        //        //          depiction can force unserialization to fail.
        //        "__loop", // Probably not useful
        //
        //        // "__makeList", already in default env / unenv
        //        "__makeMap",
        //        "__makeProtocolDesc",
        //        "__makeMessageDesc",
        //        "__makeParamDesc",
        //
        //        "__makeFinalSlot",
        //        "any",
        //        "void",
        //
        //        "boolean",
        //        "__makeOrderedSpace",
        //
        //        // "NaN", already in default env / unenv
        //        // "Infinity", already in default env / unenv
        //        // "__identityFunc", already in default env / unenv
        //        // "__makeInt", already in default env / unenv
        //
        //        "__makeTwine",
        //        "__makeSourceSpan",
        //
        //        "Guard",
        //        "__auditedBy",
        //        "near",
        //        "pbc",
        //        "PassByCopy",
        //        "DeepFrozen",
        //        "DeepPassByCopy",
        //        "Persistent",
        //
        //        "int",
        //        "float64",
        //        "char",
        //
        //        "String",
        //        "Twine",
        //        "TextWriter",
        //
        //        "require",
        //
        //        "nullOk",
        //        "vow",
        //        "rcvr",
        //        "SturdyRef",
        //        "simple__quasiParser",
        //        "rx__quasiParser",
        //        "e__quasiParser",
        //        "sml__quasiParser",
        //        "term__quasiParser",
        //
        //        // universals above. Below is only safe.
        //
        //        "__equalizer",
        //        "__comparer",
        //        "Ref",
        //
        //        "E",
        //        "promiseAllFulfilled",
        //
        //        "EIO",
        //        "help",
        //        "safeEnv",
        //
        //        "resource__uriGetter" // Should be in other list
        //    ], [
        //        // "resource__uriGetter", Uncalling not yet implemented
        //
        //        "type__uriGetter",
        //        // "import__uriGetter", already in default env, unenv
        //        //                      and uncallers
        //        "elib__uriGetter",
        //        "elang__uriGetter"
        //        // "opaque__uriGetter" separate policy decision to include
        //    ])
        //}
        //
        ///**
        // * Starts by doing an addFromSafeEnv()
        // */
        //to addFromPrivEnv(privEnv) :void {
        //    surgeon.addFromSafeEnv()
        //    surgeon.addFromEnv(privEnv, [
        //        "makeCommand",
        //
        //        "stdout",
        //        "stderr",
        //        "print",
        //        "println",
        //        "interp",
        //
        //        "entropy",
        //        "timer",
        //        "introducer",
        //        "identityMgr",
        //
        //        "makeSturdyRef",
        //        // "timeMachine", Too early. Must add it after timeMachine
        //        //                is made.
        //
        //        "currentVat",
        //        "rune",
        //
        //        // "awt__uriGetter", validity is runner dependent
        //        // "swing__uriGetter", validity is runner dependent
        //        // "JPanel__quasiParser", validity is runner dependent
        //
        //        // "swt__uriGetter", validity is runner dependent
        //        // "currentDisplay", validity is runner dependent
        //        // "swtGrid__quasiParser", validity is runner dependent
        //
        //        "privilegedEnv",
        //
        //        "unsafe__uriGetter" // it's a loader, but special
        //    ], [
        //        // "unsafe__uriGetter", as loader, handled separately below
        //
        //        "file__uriGetter",
        //        "fileURL__uriGetter",
        //        "http__uriGetter",
        //        "ftp__uriGetter",
        //        "gopher__uriGetter",
        //        "news__uriGetter",
        //
        //        "captp__uriGetter"
        //    ])
        //
        //    // Insert after the import__uriGetter, so it has lower priority
        //    var i = uncallers.indexOf1(<import>) + 1
        //    uncallers(i,i) = [privEnv["unsafe__uriGetter"]]
        //}
    });
    return surgeon;
}

Surgeon.withSrcKit = function (optPrefix) {
    return Surgeon({depictionBuilderMaker: deJavaScriptKit,
                    optPrefix: optPrefix,
                    depictionRecognizer: deJavaScriptKit}).snapshot();
};

// exports
cajita.freeze({
  Surgeon: Surgeon
});