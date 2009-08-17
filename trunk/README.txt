This is Caja-CapTP.

--- Building

To build it you will need Google Caja, downloaded or symlinked to caja/.

Run "make".

--- Testing

To run the tests you will need E-on-JavaScript (and therefore E-on-Java), built (see its readme file) and symlinked to eojs/. 

Run "make test"; the test files should open in your web browser. (The BROWSER environment variable can be used to control which web browser is invoked.)

As well as the progress bar at the top, each test case has a bar to the left of it: dashed is not-yet-run, gray is successful, and red is unsuccessful (red text is actual output and green text is expected output). (This display subject to change with E-on-JavaScript versions.)

--- Documentation

In this source tree:

  * For an introduction to Data-E serialization, read test/surgeon.updoc .

Elsewhere:

  See <http://code.google.com/p/caja-captp/w/list>.

--- Immediate TODO list:

Uncomment some tests in captp-connection and make them pass.
Change atomType in Data-E to use guards rather than predicates.