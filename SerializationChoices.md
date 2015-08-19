# Environments #

`defaultEnv` and `defaultUnenv` in the Data-E module provide an environment whose contents are
  * those of the Cajita `___.sharedImports` object, and
  * `DataE_JS1_builtinsMaker` which is [the builtinsMaker object from the Data-E module](http://code.google.com/p/caja-captp/source/browse/trunk/test/call-uncall.updoc). The "1" is a version number for compatibility in the event that its protocol is incompatibly changed.

The env used by CapTP is the `defaultEnv` plus the [CapTP-specific exits](http://wiki.erights.org/wiki/CapTP#Data-E_configuration), and:

  * `CapTP_JS1_Swiss`: The SwissNumber/Base/Hash wrapper constructor. I don't know whether this will be replaced by some better scheme for types.

# Uncalling #

XXX write the rest of this info.

In CapTP, an object marked PassByConstruction (XXX explain how this happens), if it does not have a `CapTP__optUncall` method, is serialized as a record, i.e. the collection of its properties.