// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............
"use strict,cajita";

// This file is a placeholder for Mark Miller's guard system for Caja (2009-08-16: see http://codereview.appspot.com/105065/patch/3020/3030 ). It will mostly go away except for any custom bits once that is part of released Caja.
//
// This file does not incorporate any of that code because it is copyright Google and Apache licensed, whereas this project is MIT-licensed. Therefore, it has been written from scratch, reproducing *only* externally visible naming conventions.
// 
// These implementations are quick and stubby and SHOULD be replaced as soon as possible.


function eject(ej, error) {
  if (ej) ej(error);
  throw(error);
}

function fail(sp, g, ej, msg) {
  eject(ej, new Error("Not accepted by " + g + (msg ? ": " + msg : "")));
}

function makeTypeGuard(type) {
  var g = cajita.freeze({
    toString: function () { return "T." + type + "T"; },
    coerce: function (sp, ej) { 
      if (typeof(sp) === type) {
        return sp;
      } else {
        fail(sp, g, ej);
      }
    }
  });
  return g;
}

var AnyT = cajita.freeze({
  toString: function () { return "T.AnyT"; },
  coerce: function (sp, ej) { return sp; }
});

var booleanT = makeTypeGuard("boolean");
var functionT = makeTypeGuard("function");
var numberT = makeTypeGuard("number");
var objectT = makeTypeGuard("object");
var stringT = makeTypeGuard("string");
var undefinedT = makeTypeGuard("undefined");

function IntegerGuard(least, most) {
  cajita.enforce(least === least >> 0, "integer least " + least);
  cajita.enforce(most === most >>> 0, "integer most " + most);
  cajita.enforce(least >= 0 && most < Math.pow(2,32) || most < Math.pow(2,31), "valid int32 or uint32 range");
  
  // Used for printing and for testing. The least==0 is for pretty printing, the 2^31 check is also for necessity of which test works.
  var isUnsigned = least == 0 || most >= Math.pow(2, 31);
  
  var g = cajita.freeze({
    toString: function () {
      if (isUnsigned) {
        return "T.uint32T" + (least > 0 ? ".atLeast(" + least + ")" : "") + (most < Math.pow(2,32)-1 ? ".below(" + (most+1) + ")" : "");
      } else {
        return "T.int32T" + (least > -Math.pow(2,31) ? ".atLeast(" + least + ")" : "") + (most < Math.pow(2,31)-1 ? ".atMost(" + most + ")" : "");
      }
    },
    atLeast: function (n) { return IntegerGuard(Math.max(least, n  ), most); },
    above  : function (n) { return IntegerGuard(Math.max(least, n+1), most); },
    atMost : function (n) { return IntegerGuard(least, Math.min(most, n  )); },
    below  : function (n) { return IntegerGuard(least, Math.min(most, n+1)); },
    coerce: function (sp, ej) {
      sp = numberT.coerce(sp, ej);
      if ((isUnsigned ? sp === sp >>> 0 : sp === sp >> 0) && least <= sp && sp <= most) { 
        return sp;
      } else {
        fail(sp, g, ej);
      }
    }
  });
  return g;
}

var T = cajita.freeze({
  toString: function () { return "T"; },
  
  // utilities
  eject: eject,
  
  // basic guards:
  AnyT: AnyT,
  
  // primitive types
  booleanT:   booleanT,
  functionT:  functionT, 
  numberT:    numberT,
  objectT:    objectT,
  stringT:    stringT,
  undefinedT: undefinedT,
  
  // integer ranges
  int32T:  IntegerGuard(-Math.pow(2,31), Math.pow(2,31)-1),
  uint32T: IntegerGuard(0,               Math.pow(2,32)-1)
});

// exports
cajita.freeze({
  T: T
});