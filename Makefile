.PHONY: all clean lib tests test

RUNE = rune -cpa eojs/lib-host -cpa eojs/tagsoup.jar

# -----------------------------------------------------------------------------

all: lib tests

clean:
	rm -f src/*.out.js test/*.live.xhtml

lib: src/datae.out.js src/uncallers.out.js

tests: test/datae.live.xhtml test/call-uncall.live.xhtml

test: all
	for f in test/*.live.xhtml; do python -m webbrowser "file://`pwd`/$$f"; done

# -----------------------------------------------------------------------------

%.out.js: %.js
	caja/bin/cajole_html --input "$^"

%.live.xhtml: %.updoc.html
	@# XXX hardcoded base only works for files in one subdir
	$(RUNE) eojs/updoc-animate.e --base '../eojs/serve/' "$^" > "$@" || rm "$@"

%.live.xhtml: %.updoc
	@# XXX hardcoded base only works for files in one subdir
	$(RUNE) eojs/updoc-animate.e --base '../eojs/serve/' --script '../caja/ant-lib/com/google/caja/plugin/html-sanitizer-minified.js' --script '../caja/ant-lib/com/google/caja/plugin/domita-minified.js' "$^" > "$@" || rm "$@"
