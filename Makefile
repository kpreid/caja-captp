.PHONY: all clean lib tests test

RUNE = rune -Dfile.encoding=utf-8 -cpa eojs/lib-host -cpa eojs/tagsoup.jar

# -----------------------------------------------------------------------------

all: lib tests

clean:
	rm -f {src,test}/*.out.{js,html} test/*.live.xhtml

lib: src/everything.out.js

tests: \
   test/test-util.out.js \
   test/call-uncall.live.xhtml \
   test/captp-connection.live.xhtml \
   test/captp-objects.live.xhtml \
   test/captp-trace.live.xhtml \
   test/datae.live.xhtml \
   test/guards.live.xhtml \
   test/proxy.live.xhtml \
   test/ref.live.xhtml \
   test/surgeon.live.xhtml \
   test/SwissTable.live.xhtml

test: all
	for f in test/*.live.xhtml; do python -m webbrowser "file://`pwd`/$$f"; done

# -----------------------------------------------------------------------------

# NOTE: This list determines the runtime load order and import relationships, which is important.
src/everything.out.js: \
   src/_header.js \
   src/authorizer.js \
   src/guards.out.js \
   src/util.out.js \
   src/sha1.out.js \
   src/ref.out.js \
   src/uncallers.out.js \
   src/datae.out.js \
   src/Surgeon.out.js \
   src/captp.out.js \
   src/captp-NonceLocator.out.js \
   src/captp-connection.out.js \
   src/_footer.js
	cat $^ > "$@"

# -----------------------------------------------------------------------------

%.out.js: %.js
	caja/bin/cajole_html --input "$^"
	rm -f "$*.out.html"

%.live.xhtml: %.updoc.html
	@# XXX hardcoded base only works for files in one subdir
	$(RUNE) eojs/updoc-animate.e --base '../eojs/serve/' "$<" > "$@"

%.live.xhtml: %.updoc
	@# XXX hardcoded base only works for files in one subdir
	$(RUNE) eojs/updoc-animate.e --base '../eojs/serve/' --script '../caja/ant-lib/com/google/caja/plugin/html-sanitizer-minified.js' --script '../caja/ant-lib/com/google/caja/plugin/domita-minified.js' "$<" > "$@"
