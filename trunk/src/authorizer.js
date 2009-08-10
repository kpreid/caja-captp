// Except as otherwise noted, 
// Copyright 2009 Kevin Reid, under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

/* 
   This file is to be executed *uncajoled* in the browser to define the authorities required by Caja-CapTP. It has the form of a Cajita module so that its output is handled by the new module handler.
   
   Currently, this file is just incorporated into the 'load everything' module. Therefore, the names it exports are prefixed with 'PRIV_' so as to help authority analysis. XXX It would be better to use the author pattern as in E: construct the authority, then have a simple module instantiate everything else with explicitly specified authority.
   
   It also exports an object named "console", which is a taming and extension of the Firebug/Safari/... "console" object.
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
    if (window.console) {
      function tameConsoleMethod(m) {
        // Wrapper to both make this a simple function and to hang a prefix on the log messages.
        return ___.frozenFunc(function () {
          var argsArray = ___.args(arguments);
          var format = argsArray[0];
          cajita.enforceType(format, "string");
          m.apply(console, ["Caja-CapTP: " + format].concat(argsArray.slice(1)));
        });
      }

      var tameConsole = cajita.freeze({
        log:   tameConsoleMethod(console.log),
        info:  tameConsoleMethod(console.info),
        warn:  tameConsoleMethod(console.warn),
        error: tameConsoleMethod(console.error),
        
        // nonstandard extension: unseals the stack of the error which is the last argument
        ccCaughtError: ___.frozenFunc(function () {
          var argsArray = ___.args(arguments);
          try {
            var error = argsArray[argsArray.length - 1];
            tameConsole.error.apply(tameConsole, argsArray.concat([" [error with stack:]\n", ___.callStackUnsealer(error.stack)]));
          } catch (e) {
            tameConsole.error.apply(tameConsole, argsArray.concat([" [failed to unseal stack: ", e, "]"]));
          }
        })
      });
    } else {
      var stub = ___.frozenFunc(function () {});
      var tameConsole = cajita.freeze({
        log:   stub,
        info:  stub,
        warn:  stub,
        error: stub,
        ccCaughtError: stub
      });
    }
    
    // exports
    return cajita.freeze({
      console: tameConsole,
      PRIV_scheduling: scheduling,
    });

  }});
}