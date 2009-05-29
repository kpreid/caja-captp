var deJSONTreeKit = (function () {
  return {
    toString: function () { return "deJSONTreeKit"; },
    makeBuilder: function () { 
      return {
        toString: function () { return "<deJSONTreeKit builder>"; },
        
        buildRoot: function (node) {
          return node;
        },
        
        buildLiteral: function (literal) {
          var t = typeof(literal);
          if (t === "string") {
            return cajita.freeze(["string", literal]);
          } else if (t === "number") {
            // XXX review whether we would like to support explicit ints
            return cajita.freeze(["float64", literal]);
          }
        },
        
      }; // end builder
    }
  }; // end deJSONTreeKit
})();

var deSubgraphKit = (function () {
  return {
    toString: function () { return "deSubgraphKit"; },
    makeBuilder: function () { 
      return {
        toString: function () { return "<deSubgraphKit builder>"; },
        
        buildRoot: function (node) {
          return node;
        },
        
      }; // end builder
    }
  }; // end deSubgraphKit
})();


// exports
({
  "deJSONTreeKit": deJSONTreeKit,
  "deSubgraphKit": deSubgraphKit
});