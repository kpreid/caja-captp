This page documents the choices made in order to fit the E-designed CapTP system into the JavaScript world, and their rationales.

# Refs #

The "Ref" and "E" objects in E have been conflated into the "Ref" object in Caja-CapTP. Rationale: Since this is not an E system, the "E" name is inappropriate and it would be extra design and extra user learning to invent a different one. Refs and call/send are closely tied so there is no need to separate them.

# Miranda methods #

The number of [Miranda messages](http://wiki.erights.org/wiki/Miranda_message) used has been kept to a minimum; all have their prefixed E names but are with "CapTP", in order to reduce the chance of name conflicts.

  * `CapTP__optUncall`: Required for objects to be serializable without requiring applications to globally register uncallers.
  * `CapTP__whenMoreResolved`: Required for the CapTP protocol and by users of promises.
  * `CapTP__whenBroken`: Required by users of far references.

_To be reviewed:_ Prefixing the `when` Miranda messages' names will show up over the network. This may be troublesome for interop.

# Uncallers #

The JavaScript `null` value, rather than `undefined`, was chosen to indicate an uncaller not returning a portrayal. Rationale: It is easier to accidentally return undefined than null; thus if undefined is an error bugs will be caught sooner.

# Data-E and CapTP #

In E, the primary operation on objects is the call. In JavaScript, there is a method call/function call distinction as well as property access (which does not ordinarily invoke code of the object). Caja-CapTP chooses _not_ to provide representation of this in Data-E [portrayal](portrayal.md)s and CapTP Deliver messages, and represent them instead as method calls of one sort or another. Rationale:
  * Interoperation with E CapTP implementations is an eventual goal, and introducing distinctions which do not exist in E would make this difficult, whereas the special objects and messages used instead **can** be provided.
  * There are in fact quite a few such operations: function call, constructor call (`new`), property read, property write, property delete, the `in` operator. Supporting each in the Data-E and CapTP protocol layers would be unnecessary complexity; expressing them in terms of objects is more generic and extensible.