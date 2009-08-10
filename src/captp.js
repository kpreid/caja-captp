"use strict,cajita";
// Except as otherwise noted, 
// Copyright 2007-2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

// XXX To operate properly, this *SHOULD* be a crypto-strength PRNG.
var entropy = cajita.freeze({
  nextSwiss: function () {
    // A swiss number is 20 octets or 160 bits. To generate this out of floats, we use Math.random several times. To fit this in a JavaScript value we use a string with 8 bits per character (which happens to be compatible with the sha1 library).
    var swiss = "";
    for (var i = 0; i < 20; i++) {
      swiss += String.fromCharCode(Math.random() * 256);
    }
    return new Swiss(swiss);
  }
});


// In E implementations SwissNumbers are long integers. JavaScript does not have long integers. So we use strings of character codes <256 denoting octets instead.
// This wrapper provides the operations on it and also ensures that the bits are not leaked in an exception etc. by toString.
function Swiss(value) {
  cajita.enforceType(value, "string"); // XXX does not check details
  return cajita.freeze({
    // The function used to hash SwissBase->SwissNumber->SwissHash.
    hash: function () {
      return new Swiss(str_sha1(value));
    },
    
    bits: value,

    showBits: function () {
      return binb2hex(str2binb(value));
    },
    
    toString: function () {
      return "[Swiss number]";
    }
  });
}
Swiss.enforce = function (value) {
  return new Swiss(value.bits);
};

// Produce a data structure describing the structure of CapTP messages.
function makeMessageTable(typeMap) {
  return cajita.freeze([
    cajita.freeze(["DeliverOnly",  [typeMap.IncomingPos, typeMap.MsgName, typeMap.Obj]]),
    cajita.freeze(["Deliver",      [typeMap.AnswerPos, typeMap.Obj, typeMap.IncomingPos, typeMap.MsgName, typeMap.Obj]]),
    cajita.freeze(["GCExport",     [typeMap.ExportPos, typeMap.WireDelta]]),
    cajita.freeze(["GCAnswer",     [typeMap.AnswerPos]]),
    cajita.freeze(["Shutdown",     [typeMap.MsgCount]])
    //cajita.freeze(["Terminated", [typeMap.Obj]]),
    //cajita.freeze(["Wormhole",   [typeMap.Data, typeMap.VatID, typeMap.VatID]])
  ]);
}

function makeWeakKeyMap() { 
  return cajita.newTable(true); 
};
function makeWeakValueMap() {
  // XXX This does not produce even an approximation of a weak value map. Furthermore, cajita.newTable is moving to weak-key-table exclusively when possible; we need our own strategy.
  return cajita.newTable(false);
}

var CommTableMixin = (function () {
  // The code within this block is derived, by way of the E-on-CL CapTP 
  // implementation, from the E-on-Java CapTP implementation, and is therefore:
  // Copyright 2002 Combex, Inc. under the terms of the MIT X license
  // found at http://www.opensource.org/licenses/mit-license.html ...............

  // Default initial capacity
  var INIT_CAPACITY = 16;

  var GROWTH_FACTOR = 2;

  //var Index :DeepFrozen := int > 0;

  /**
   *
   * Just some common mechanism made available to the CommTable implementations.
   * <p/>
   * <p/>
   * CommTables are defined in terms of indices (always positive), not position.
   * At a higher level, positions use positive or negative to encode choice of
   * table (questions vs imports, answers vs exports). This can be a bit
   * confusing because CommTable internally uses negated indices for free list
   * entries, and these two uses of negation are completely independent.
   * <p/>
   * The rest of CapTP depends on the tables, but for the sake of unit testing,
   * each table stands alone to the greatest reasonable degree. Since
   * AnswersTable adds almost nothing to CommTable, you can unit test CommTable
   * by testing AnswersTable.
   *
   * @author Mark S. Miller
   */
  var CommTableMixin = function (self) { // stuffs methods into the object self
      /**
       * Used to indicate the absence of any other object
       */
      var ThePumpkin = cajita.freeze({toString: function () { return "ThePumpkin"; }});

      // How many allocated entries do I have?
      var mySize = 0;

      // What is the size of my parallel arrays?
      var myCapacity = INIT_CAPACITY;

      // Keeps track of the allocation of my indices. <p>
      // <p/>
      // myFreeList[0] is unused and always has the value 0. For all i >= 1, if
      // myFreeList[i] >= 1, it's an allocation count. Otherwise, let next :=
      // (-myFreeList[i]). If next >= 1, it's the index of the next free entry in
      // myFreeList. If next == 0, we're at the end of the list.
      //
      var myFreeList = new Array(myCapacity);
      for (var i = 1; i < myCapacity; i++) {
          //each entry points at the next
          myFreeList[i] = -(i + 1);
      }
      //overwrite the last entry
      myFreeList[myCapacity - 1] = 0;

      // Let first = -myFreeHead; If first >= 1, it's the index of the first free
      // entry in myFreeList. If first == 0, the list is empty.
      //
      // point at the first allocatable entry
      var myFreeHead = -1;

      // The actual contents of the table.
      var myStuff = new Array(myCapacity);
      myStuff[0] = undefined;
      for (var i = 1; i < myCapacity; i++) {
          myStuff[i] = ThePumpkin;
      }

      /**
       * What the next capacity big enough to represent index?
       */
      var bigEnough = function (index) {
          cajita.enforceNat(index);
          if (0 >= index) {
              throw new Error("bad index: " + index);
          }
          var result = myCapacity;
          while (index >= result) {
              //XXX it's stupid to have an iterative algorithm. How do I
              //calculate the smallest power of 2 > index?
              result += GROWTH_FACTOR;
          }
          return result;
      };

      /**
       * Become big enough to hold index. <p>
       * <p/>
       * Newly added elements are on the (newly grown) free list.
       */
      var growToHold = function (index) {
          cajita.enforceNat(index);
          var oldCapacity = myCapacity;
          myCapacity = bigEnough(index);
          if (oldCapacity === myCapacity) {
              return;
          }
          myFreeList.setSize(myCapacity);
          myStuff.setSize(myCapacity);
          for (var i = oldCapacity; i < myCapacity; i++) {
              //each entry points at the next
              myFreeList[i] = -(i + 1);
              myStuff[i] = ThePumpkin;
          }
          //overwrite the last entry
          myFreeList[myCapacity - 1] = myFreeHead;
          myFreeHead = -oldCapacity;
      };

      
      /** For inheritors' use. XXX is this information okay to reveal? */
      self._getCapacity = function () { return myCapacity; };

      /**
       * Drop all state and make sure nothing ever works again.
       */
      self.smash = function (problemThrowable) { // XXX not using problem? -- kpreid 2009-06-05
          mySize = -1;
          myCapacity = -1;
          myFreeList.length = 0;
          myFreeHead = 1;
          myStuff.length = 0;
      };

      /**
       * How many allocated entries?
       */
      self.size = function () {
          return mySize;
      };

      /**
       * Is this index free?  If it's past the end, yes. If it's before the
       * beginning, it's not valid, so no.
       */
      self.isFree = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero
          return index >= myCapacity || 0 >= myFreeList[index];
      };

      /**
       * Complain if not free
       */
      self.mustBeFree = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero
          if (!self.isFree(index)) {
              throw new Error("" + index + " not free in " + self);
          }
      };

      /**
       * Complain if not allocated
       */
      self.mustBeAlloced = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero
          if (self.isFree(index)) {
              throw new Error("" + index + " not alloced in " + self);
          }
      };

      /**
       * Deallocates an allocated index. <p>
       * <p/>
       * Subclasses may override and send-super in order to clear their parallel
       * arrays.
       */
      self.free = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero

          self.mustBeAlloced(index);
          myFreeList[index] = myFreeHead;
          myFreeHead = -index;
          myStuff[index] = ThePumpkin;
          mySize -= 1;
      };

      /**
       * Increment index's allocation count. <p>
       * <p/>
       * index must already be allocated
       */
      self.incr = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero
          
          self.mustBeAlloced(index);
          myFreeList[index] += 1;
      };

      /**
       * Decrement index's allocation count delta, and free it if it reaches
       * zero.
       * <p/>
       * On entry, index must be allocated.
       *
       * @return whether the entry got freed
       */
      self.decr = function (index, delta) {
          cajita.enforceNat(index);
          // XXX reject zero
          cajita.enforceNat(delta);

          self.mustBeAlloced(index);
          var newCount = myFreeList[index] - delta;
          if (0 >= newCount) {
              self.free(index);
              return true;
          } else {
              myFreeList[index] = newCount;
              return false;
          }
      };

      /**
       * Allocate a particular index. <p>
       * <p/>
       * On entry, index must be free. <p>
       * <p/>
       * Since the free list is singly linked, we can't generally do this in
       * constant time. However, by far the typical case is for the requested
       * index to be the same as the one that zero-argument alloc would have
       * allocated, so we need merely assure that this case is constant time.
       */
      self.alloc = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero

          self.mustBeFree(index);
          growToHold(index);
          if (index === -myFreeHead) {
              //we win
              myFreeHead = myFreeList[index];
              myFreeList[index] = 1;
              mySize += 1;
              return;
          }
          //we lose. Search the free list for -index
          var i = -myFreeHead;
          while (0 !== i) {
              var next = -(myFreeList[i]);
              if (index === next) {
                  myFreeList[i] = myFreeList[index];
                  myFreeList[index] = 1;
                  mySize += 1;
                  return;
              }
              i = next;
          }
          throw new Error("internal: broken free list");
      };


      /**
       * Gets the object at the allocated index.
       */
      self.get = function (index) {
          cajita.enforceNat(index);
          // XXX reject zero

          self.mustBeAlloced(index);
          var result = myStuff[index];
          if (identical(ThePumpkin, result)) {
              throw new Error("export: " + index + " is a pumpkin");
          }
          return result;
      };

      /**
       *
       */
      self.set = function (index, value, strict) {
          if (strict === undefined) strict = false;
          cajita.enforceType(strict, "boolean");
          cajita.enforceNat(index);
          // XXX reject zero

          if (self.isFree(index)) {
              self.alloc(index);
              myStuff[index] = value;
          } else if (strict) {
              throw new Error("not free: " + index);
          } else {
              myStuff[index] = value;
          }
      };

      /**
       * Allocates a free index, put value there, and returns that index.
       * <p/>
       * Subclasses may override and send-super to initialize their parallel
       * arrays.
       * <p/>
       * The wireCount is initialized to one
       */
      self.bind = function (value) {
          if (myCapacity == -1) {
              throw new Error("cannot bind in " + self);
          }
          if (0 == myFreeHead) {
              growToHold(myCapacity);
          }
          var result = -myFreeHead;
          self.mustBeFree(result);
          myFreeHead = myFreeList[result];
          myFreeList[result] = 1;
          myStuff[result] = value;
          mySize += 1;
          return result;
      };

      /**
       *
       */
      self.stateToString = function () {
        var out = "";
        if (myCapacity == -1) {
          out += "(smashed)";
          return;
        }
        out += "[";
        for (var i = 1; i < myCapacity; i++) {
          if (!self.isFree(i)) {
            out += "\n  " + i + ":" + myStuff[i];
          }
        }
        out += "\n], free: [";
        var i = -myFreeHead;
        while (0 !== i) {
          out += " " + i;
          i = -(myFreeList[i]);
        }
        out += "]";
        return out;
      };

      self.toString = function () {
          return "<" + self.commTableType + " " + self.stateToString() + ">";
      };
      
      return self;
  };
  //CommTableMixin.toString = function () { return "CapTP.makeCommTable"; };
  return CommTableMixin;
})();

/**
 * A weak-value table mapping from SwissNumbers to references.
 * <p/>
 * There are two cases: 1) NEAR references to Selfish objects. 2) Everything
 * else. For case #1, a backwards weak-key table is also maintained, such that
 * multiple registrations of a NEAR Selfish object will always yield the same
 * SwissNumber. This SwissNumber can then be (and is) used remotely to
 * represent the sameness identity of resolved references to this Selfish
 * object. Case #1 is used for both live and sturdy references.
 * <p/>
 * Case #2 is used only for sturdy references. The table only maps from
 * SwissNumbers to references, not vice versa, so each registration assigns a
 * new SwissNumber.
 *
 * @author Mark S. Miller
 */
function SwissTable() {
  // The code within this block is derived, by way of the E-on-CL CapTP 
  // implementation, from the E-on-Java CapTP implementation, and is therefore:
  // Copyright 2002 Combex, Inc. under the terms of the MIT X license
  // found at http://www.opensource.org/licenses/mit-license.html ...............
  
  // Maps from NEAR Selfish objects to SwissNumbers.
  var mySelfishToSwiss = makeWeakKeyMap();

  // Maps from SwissNumber to anything.
  //
  // Note: can't handle undefined values.
  var mySwissToRef = makeWeakValueMap();

  // OneArgFuncs that handle lookup faulting.
  var mySwissDBs = [];

  var swissTable = cajita.freeze({
    toString: function () { return '[SwissTable]'; },

    /**
     * Lookup an object by SwissNumber. <p>
     * <p/>
     * If not found, throw an IndexOutOfBoundsException. This is necessary
     * since undefined is a valid return value. (By decree, the SwissNumber 0
     * designates undefined.)    // XXX caja-captp: Is using undefined as the special value important?
     */
    "lookupSwiss": function (swissNum) {
      Swiss.enforce(swissNum);
      if (0 === swissNum) {
          //Since Weak*Maps can't handle nulls, we handle it ourselves. <- caja-captp: This is an inherited comment.
          return undefined;
      }
      var res = mySwissToRef.get(swissNum);
      if (res !== undefined) {
        return res;
      }
      var swissHash = swissNum.hash();
      for (var i = 0; i < mySwissDBs.length; i++) {
          var db = mySwissDBs[i];
          //give each fault handler a chance
          db(swissHash);
      }
      //try one more time
      res = mySwissToRef.get(swissNum);
      if (res !== undefined) {
        return res;
      }
      throw new Error("Swiss number not found");
    },

    /**
     * A SwissDB is able to supplement the SwissTable's internal mySwissToRef
     * table with further storage that gets faulted on demand. <p>
     * <p/>
     * When the SwissTable's lookupSwiss fails to find the swissNum in the
     * internal table, it invokes each of its registered swissDBs with a hash
     * of the swissNumber being looked up. This is known as a swissHash, and
     * represents the identity of the object without providing any authority to
     * access the object. A swissDB which has stored a representation of the
     * object elsewhere should then register the object using registerIdentity
     * or registerSwiss, both of which require the swissBase -- the archash of
     * the swissNumber being looked up. In other words,
     * <pre>
     *     swissBase.cryptoHash() -> swissNum
     *     swissNum.crytoHash()   -> swissHash
     * </pre><p>
     * <p/>
     * If an already registered swissDB is re-registered, an exception is
     * thrown.
     */
    addFaultHandler: function (swissDB) {
      var i = mySwissDBs.indexOf(swissDB);
      if (i < 0) {
        mySwissDBs.push(swissDB);
      }
    },

    /**
     * Removes a registered (by addFaultHandler) swissDB. <p>
     * <p/>
     * If not there, this method does nothing.
     */
    removeFaultHandler: function (swissDB) {
      var i = mySwissDBs.indexOf(swissDB);
      mySwissDBs.splice(i, 1);
    },

    /**
     * Returns the SwissNumber which represents the identity of this near
     * Selfish object in this vat.
     * <p/>
     * If not 'Ref.isSelfish(obj)", then this will throw an Exception.
     * <p/>
     * This returns the unique SwissNumber which represents the designated near
     * selfish object's unique identity within this vat. If the object wasn't
     * yet associated with a SwissNumber, it will be now.
     */
    getIdentity: function (obj) {
        obj = Ref.resolution(obj);
        if (!Ref.isSelfish(obj)) {
            throw new Error("Not Selfish: " + obj);
        }
        var result = mySelfishToSwiss.get(obj);
        if (undefined === result) {
            result = entropy.nextSwiss();
            mySwissToRef.set(result, obj);
            mySelfishToSwiss.set(obj, result);
        }
        return result;
    },

    /**
     * Returns a SwissNumber with which this ref can be looked up.
     * <p/>
     * This method always assigns and returns a new unique SwissNumber (an
     * integer of some type), even for NEAR Selfish objects that already have
     * one, with one exception. The swissNumber for undefined is always 0.
     *
     * XXX the above seems to be false since the current implementation uses getIdentity
     */
    "getNewSwiss": function (ref) {
        ref = Ref.resolution(ref);
        if (Ref.sameYet(undefined, ref)) {
            return 0;
        }
        if (Ref.isSelfish(ref)) {
            return swissTable.getIdentity(ref);
        }
        var result = entropy.nextSwiss();
        mySwissToRef.set(result, ref);
        return result;
    },

    /**
     * Registers obj to have the identity 'swissBase.cryptoHash()'. <p>
     * <p/>
     * The cryptoHash of a SwissBase is a SwissNumber, so we also say that the
     * archash of a SwissNumber is a SwissBase. (Of course, our security rests
     * on the assumption that the archash is infeasible to compute.) Since an
     * unconfined client of an object can often get its SwissNumber, something
     * more is needed to establish authority to associate an object with a
     * SwissNumber. For this "something more", we use knowledge of the archash
     * of the number. <p>
     * <p/>
     * The object is given the new identity 'swissBase cryptoHash()', assuming
     * this doesn't conflict with any existing registrations. If it does, an
     * exception is thrown.
     */
    "registerIdentity": function (obj, swissBase) {
      Swiss.enforce(swissBase);
      obj = Ref.resolution(obj);
      if (!Ref.isSelfish(obj)) {
          throw new Error("Not Selfish: " + obj);
      }
      var result = swissBase.hash();
      var oldObj =
        Ref.resolution(mySwissToRef.fetch(result, function () { return obj; }));
      require(undefined === oldObj || identical(oldObj, obj),
              function () { return "SwissNumber already identifies a different object: " +
                            result; });
      var oldSwiss =
        mySelfishToSwiss.fetch(obj, function () { return result; });
      if (oldSwiss != result) {
        throw new Error("Object already has a different identity: " +
                        oldSwiss + " vs " + result);
      }
      mySelfishToSwiss.set(obj, result);
      mySwissToRef.set(result, obj);
      return result;
    },

    /**
     * Registers ref at 'swissBase.cryptoHash()'.
     * <p/>
     * registerNewSwiss() is to registerIdentity() as getNewSwiss() is to
     * getIdentity(). 'swissBase.cryptoHash()' must not already be registered,
     * or an exception will be thrown. If ref is null, an exception is thrown
     * (since we assume its infeasible to find the archash of zero).
     */
    registerNewSwiss: function (ref, swissBase) {
        Swiss.enforceSwiss(swissBase);
        ref = Ref.resolution(ref);
        var result = swissBase.hash();
        if (undefined === ref) {
            //XXX In just the way the following is careful not to reveal more
            //than a swissHash in a thrown exception, we need to go through the
            //rest of the swissNumber and swissBase handling logic and make it
            //do likewise.
            var swissHash = result.hash();
            throw new Error("May not re-register undefined for swissHash: " + E.toString(swissHash));
        }
        var oldRef = mySwissToRef.get(result);
        if (undefined === oldRef) {
            mySwissToRef.set(result, ref);
        } else if (identical(ref, oldRef)) {
            // Registering the same object with the same base is cool.
            // XXX should we use Ref.same(..) instead of == ?
        } else {
            var swissHash = result.hash();
            throw new Error("An object with swissHash " + swissHash +
              "is already registered");
        }
        return result;
    },

    /**
     * A convenience method typically used to obtain new SwissBases (archashes
     * of SwissNumbers).
     * <p/>
     * Since a client of SwissTable can obtain such entropy from the SwissTable
     * anyway, by registering objects, there's no loss of security in providing
     * this convenience method.
     */
    nextSwiss: function () {
      return entropy.nextSwiss();
    }
  });
  return swissTable;
}

function AnswersTable() {
  var self = {};
  self = new CommTableMixin(self);
  var ancestor = cajita.snapshot(self); // Cajita bug: "super" is reserved.

  self.commTableType = "answersTable";

  return cajita.freeze(self);
}

function ExportsTable() {
  var self = {};
  self = new CommTableMixin(self);
  var ancestor = cajita.snapshot(self); // Cajita bug: "super" is reserved.
  
  //// Gets the index for a near export.
  //var myPBPMap = cajita.newTable();
  //    
  //self.smash = function (problem) {
  //    for (var i = 1; i < ancestor._getCapacity(); i++) {
  //        if (!exportsTable.isFree(i)) {
  //            E.sendOnly(exportsTable[i], "__reactToLostClient", [problem]);
  //        }
  //    }
  //    ancestor.smash(problem);
  //    myPBPMap = null;
  //};
  //
  ///**
  // * Frees the index, including its entry, if any, in the pbp map.
  // */
  //self.free = function (index) {
  //    cajita.enforceNat(index);
  //    // XXX reject zero
  //    
  //    myPBPMap.removeKey(exportsTable[index]);
  //    ancestor.free(index);
  //};
  //
  ///**
  // *
  // */
  //self.indexFor = function (obj) {
  //    return myPBPMap.fetch(obj, function () { return -1; });
  //};
  //
  ///**
  // * Allocates and returns the index of a newly exported local PassByProxy
  // * object.
  // * <p/>
  // * The wireCount is initialized to one
  // *
  // * @param pbp The local PassByProxy object to be exported
  // * @return The index of the FarRef to be created-imported on the other
  // *         end.
  // */
  //self.newFarPos = function (pbp) {
  //    // XXX kpreid wonders whether this should be an override of "bind"/1 instead
  //    
  //    // XXX kpreid wonders whether allowing coercion is correct here, and also about the consequences of failing at this point
  //    pbp = PassByProxy.coerce(pbp); // XXX JS translation: PassByProxy doesn't exist
  //    var index = exportsTable.bind(pbp);
  //    myPBPMap.set(pbp, index, true);
  //    return index;
  //};

  self.commTableType = "exportsTable";

  return cajita.freeze(self);
}

function ProxiesTable() {
  var self = {};
  self = new CommTableMixin(self);
  var ancestor = cajita.snapshot(self); // Cajita bug: "super" is reserved.
  
  self.commTableType = "proxiesTable";
  
  return cajita.freeze(self);
}

function NearGiftTable() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<nearGiftTable>'; }
  });
}

function PromiseGiftTable() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<promiseGiftTable>'; }
  });
}

function NonceLocator() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<nonceLocator>'; }
  });
}

function LocatorUnum() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<locatorUnum>'; }
  });
}


function CapTPConnection() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<CapTPConnection>'; }
  });
}

var traceMessages = (function () {

  // This is a Data-E kit used as a value-rather-than-Data-E-protocol intermediate representation; the particular kit used is arbitrary
  var bufferingKit = deJSONTreeKit;

  function convertDE(f) {
    var builder = bufferingKit.makeBuilder();
    var ast = f(builder);
    function deProvider(builder) {
      return bufferingKit.recognize(ast, builder);
    }
    deProvider.toString = function () {
      var ancestor = deJavaScriptKit.makeBuilder();
      var twiddleBuilder = cajita.copy(ancestor);
      twiddleBuilder.buildCall = function (rec, verb, args) {
        if (rec === "CapTP_1_descs") {
          return verb + "Desc(" + args + ")"; // kludge
        } else {
          return ancestor.buildCall(rec, verb, args);
        }
      };
      return bufferingKit.recognize(ast, twiddleBuilder);
    };
    return deProvider;
  }
  
  function id(x) { return x; }
  var converterTable = cajita.freeze({
    IncomingPos: id,
    AnswerPos: id,
    ExportPos: id,
    MsgName: deJavaScriptKit.makeBuilder().buildAtom,
    MsgCount: id,
    WireDelta: id,
    Obj: convertDE
  });
  
  var messages = makeMessageTable(converterTable);

  var dispatchTable = {};
  cajita.forOwnKeys(messages, function (i) {
    var verb = messages[i][0];
    var argConverters = messages[i][1];
    dispatchTable[verb] = function (args) {
      cajita.enforce(args.length === argConverters.length, "Wrong number of arguments for CapTP ", verb, ": ", args.length, " not ", argConverters.length);
      var result = [];
      for (var i = 0; i < args.length; i++) {
        result.push(argConverters[i](args[i]));
      }
      return cajita.freeze(result);
    };
  });
  cajita.freeze(dispatchTable);

  function traceMessages(traceCollector, nextCapTPReceiver) {

    var tracer = {
      toString: function () {
        return "[tracing CapTP to " + nextCapTPReceiver + "]";
      }
    };
    cajita.forOwnKeys(dispatchTable, function (verb) {
      var argsConverter = dispatchTable[verb];
      tracer[verb] = function () {
        var convArgs = argsConverter(arguments);
        try {
          traceCollector(verb + "(" + convArgs.join(", ") + ")");
        } catch (p) {
          console.ccCaughtError("traceMessages: problem with collector: ", p);
        }
        if (nextCapTPReceiver !== null) {
          (Ref.isNear(nextCapTPReceiver) ? Ref.call : Ref.sendOnly)(nextCapTPReceiver, verb, convArgs);
        }
      };
    });
    return cajita.freeze(tracer);
  }
  
  return traceMessages;
  
})();

// exports
cajita.freeze({
  CapTPConnection: CapTPConnection,

  // exported only for testing
  AnswersTable: AnswersTable,
  ExportsTable: ExportsTable,
  LocatorUnum: LocatorUnum,
  NearGiftTable: NearGiftTable,
  NonceLocator: NonceLocator,
  PromiseGiftTable: PromiseGiftTable,
  ProxiesTable: ProxiesTable,
  
  Swiss: Swiss,
  SwissTable: SwissTable,
  
  traceMessages: traceMessages
});