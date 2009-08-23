// --- Beginning of concatenated-module gimmick footer ---
    realtriple_concatmodule___.loadModule({
      "instantiate": function (triplePassedIn, IMPORTS___) {
        var global = this;
        var debug = global.console && global.console.groupCollapsed && global.console.group && global.console.groupEnd && global.console.log;
        if (debug) console.groupCollapsed("Loading Caja-CapTP");
        // Each module sees the outside imports as well as preceding modules' exports;
        // but the caller sees only exports.
        var exports = {};
        var imports = cajita.copy(IMPORTS___);
        for (var i = 0; i < submodules_concatmodule___.length; i++) {
          if (debug) console.group("Submodule #", i, " exports");
          var inst = submodules_concatmodule___[i].instantiate(triplePassedIn, cajita.snapshot(imports));
          cajita.forOwnKeys(inst, realtriple_concatmodule___.frozenFunc(function (exportName, value) {
            if (debug) console.log(exportName, ": ", value);
            cajita.setPub(exports, exportName, value);
            cajita.setPub(imports, exportName, value);
          }));
          if (debug) console.groupEnd();
        }
        if (debug) console.groupEnd();
        return cajita.freeze(exports);
      },
    });
  })();
})();
// --- End of concatenated-module gimmick footer ---
