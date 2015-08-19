# Major components #

  * Ref
> > The CapTP protocol is designed around E-style object references: promises/broken refs/far refs. This component is a reimplementation of the E ref system. The "Ref" object incorporates the functionality of the E "Ref" and "E" objects.
    * Files: ref.js
  * Data-E
> > The CapTP protocol needs a serialization system. Data-E is a lightweight and flexible serialization system designed with capability principles, and it is the choice for new implementations of CapTP.
    * Files: uncallers.js datae.js Surgeon.js
  * CapTP protocol
> > The CapTP protocol per se, given an ordered, reliable-delivery, private transport for _CapTP abstract messages_ (which can be straightforwardly serialized), provides message passing between individual local and remote objects, implementing [promise](promise.md)s and further ordering guarantees.
    * Files: `captp*.js`
  * Transport
> > As yet unimplemented. This component is responsible for providing CapTP's assumed reliable ordered connection using HTTP messages.

# Description of files #

  * src/: JavaScript code making up Caja-CapTP.
    * `*.js`: Uncajoled JavaScript code. Do not load.
    * `*.out.js`: (Built) Cajoled JavaScript code - intermediate files.
    * everything.js: (Built) The complete Caja-CapTP module to actually use with your application: all code packed into one Caja module.
    * `_header.js` and `_footer.js`: Support code for the packing trick.
    * authorizer.js: Code included uncajoled in everything.js to construct the authorities Caja-CapTP needs to run: timed callback and network access.
    * captp-NonceLocator.js: The CapTP [NonceLocator](http://wiki.erights.org/wiki/NonceLocator) object.
    * captp.js: Miscellaneous smallish object definitions used by the CapTP subsystem.
    * datae.js: The Data-E _kits_, which define concrete representations of object subgraphs (including the real objects).
    * ref.js: The E-style reference implementation. Caja-CapTP clients need to use this, at least to wait for promises and shorten forwarders.
    * sha1.js: SHA-1 implementation. Third-party code converted into a Caja module.
    * Surgeon.js: The Data-E [Surgeon](http://wiki.erights.org/wiki/Surgeon).
    * uncallers.js: Uncallers, environments, _unenvs_, and other support infrastructure for deSubgraphKit, the "actual objects" end of Data-E serialization.
    * util.js: Miscellaneous utility code.
  * test/:
> > The test suite for Caja-CapTP. Some of the test scripts include documentation.
> > Note that the tests are built on the _Updoc_ test framework for E, implemented by [E-on-JavaScript], and as such are written in E, not JavaScript. The differences are hopefully not too extreme.
> > Note also that many of the tests have been copied from tests written for E implementations, since [Ref](Ref.md), [Data-E], and [CapTP](CapTP.md) are originally from E.
    * `*.live.xhtml`: (Built) The Updoc test scripts converted into HTML+JavaScript documents which, when opened in a web browser, run the tests. Green bar and black text is good, anything else is a failure.
    * call-uncall.updoc: Tests the builtin uncallers.
    * captp-objects.updoc: Miscellaneous CapTP internals.
    * captp-trace.updoc: Tests the tracing module used to test CapTP.
    * datae.updoc: Tests the Data-E Kits (serialization formats).
    * proxy.updoc: Tests the proxy facility (part of [Ref](Ref.md)).
    * ref.updoc: Tests the E-style reference implementation ([Ref](Ref.md)).
    * surgeon.updoc: Tests the [Surgeon](http://wiki.erights.org/wiki/Surgeon) (high-level serialization tool). Contains discussion and examples of how to use a Surgeon.
    * SwissTable.updoc: CapTP internals.
    * test-util.js: JavaScript code to assist the test suite in things that cannot be readily done from the E/JavaScript bridge tools.