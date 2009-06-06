// Except as otherwise noted, 
// Copyright 2007-2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

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
      myStuff[0] = null;
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
          if (ThePumpkin === result) {
              throw new Error("export: " + index + " is a pumpkin");
          }
          return result;
      };

      /**
       *
       */
      self.put = function (index, value, strict) {
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
  //    myPBPMap.put(pbp, index, true);
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
    toString: function () { return '<nearGiftTable>'; },
  });
}

function PromiseGiftTable() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<promiseGiftTable>'; },
  });
}

function NonceLocator() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<nonceLocator>'; },
  });
}

function LocatorUnum() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<locatorUnum>'; },
  });
}


function CapTPConnection() {
  /// XXX fill out
  return cajita.freeze({
    toString: function () { return '<CapTPConnection>'; },
  });
}

({
  "CapTPConnection": CapTPConnection,

  // exported only for testing
  "AnswersTable": AnswersTable,
  "ExportsTable": ExportsTable,
  "ProxiesTable": ProxiesTable,
  "NearGiftTable": NearGiftTable,
  "PromiseGiftTable": PromiseGiftTable,
  "NonceLocator": NonceLocator,
  "LocatorUnum": LocatorUnum,
});