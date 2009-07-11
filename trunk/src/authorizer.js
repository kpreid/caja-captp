// Except as otherwise noted, 
// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

/* 
   This file is to be executed *uncajoled* in the browser to define the authorities required by Caja-CapTP. It has the form of a Cajita module so that its output is handled by the new module handler.
   
   Currently, this file is just incorporated into the 'load everything' module. Therefore, the names it exports are prefixed with 'PRIV_' so as to help authority analysis. XXX It would be better to use the author pattern as in E: construct the authority, then have a simple module instantiate everything else with explicitly specified authority.
*/

{
  ___.loadModule({'instantiate': function (___, IMPORTS___) {

    var scheduling = (function () {
      function tameSetTimeout(func, delay) {
        setTimeout(function () {
          cajita.callPub(func, "call", [cajita.USELESS]);
        }, delay);
      }
      ___.frozenFunc(tameSetTimeout);
      return cajita.freeze({
        setTimeout: tameSetTimeout
      });
    })();
    
    var tameConsole;
    if (console) {
      var tameConsole = cajita.freeze({
        log: ___.frozenFunc(function (text) {
          cajita.enforceType(text, "string");
          console.log(text);
        })
      });
    } else {
      var tameConsole = cajita.freeze({
        log: ___.frozenFunc(function (text) {})
      });
    }
    
    return cajita.freeze({
      PRIV_scheduling: scheduling,
      console: tameConsole,
    });

  }});
}