# Server-to-client communication #

We need to be able to asynchronously pass messages from a web server to a web browser. This requires clever gimmicks.

  * Polling is an option, obviously
  * The general category of these techniques is called “[Comet](Comet.md)”.
    * Look at [Orbited](http://orbited.org/)
      * Ah, this is a general browser-to-TCP-connection proxy. What we want is more native, passing discrete messages in JSON format. Might be useful anyway -- interop with E CapTP?
  * My notes contain "Michael Carter" and I forget why — presumably [him](http://cometdaily.com/people/michael_carter/).

# Server-side JavaScript #

We need a [CapTP](http://wiki.erights.org/wiki/CapTP) implementation on the server. That means running either [E](E.md) on JavaScript on the server, or implementing CapTP in Yet Another Language. But using JavaScript has the clear advantage that we can test _this_ CapTP implementation, and it only needs to (at first) interoperate with itself. So, use a server-side JavaScript implementation.

  * server-js group [MarkM](MarkM.md) knows (investigate what it was this meant)
  * Use Rhino as the JavaScript implementation, per a couple recommendations.

# Crypto #

For browser/server operation, we probably don't want to load crypto libraries on the client. That means that all our messages are plaintext-as-far-as-we-know delivered over HTTPS to the server, which does all the CapTP-related crypto (swiss number handling, VatIDs as public keys, etc)

All of the 'in vat' computation runs on the browser, and the crypto for outside communication runs on the server. The browser and server form a single distributed machine, in a sense.

The design of CapTP implementation may need to be revised to allow for only-asynchronous access to crypto operations.

# Addressing #

Our objects have the same address components as in Pluribus: VatID, swiss number, network address hints. However, the wire protocol is different (HTTPS-based). Therefore, it makes sense to use a different type of URL.

```
captp://*vatID@locationhints/swissnum    # Pluribus

https://*vatID@locationhint/arbitrarypath/swissnum       # Caja-CapTP perhaps
https://*vatID@locationhint/arbitrarypath/#swissnum      # Or this
```

  * To review: does it make sense to put the VatID in the userid field?
  * To review: Why does CapTP use an asterisk before the VatID?

The reason for possibly putting the swiss number in the fragment is this: In CapTP, there is at most one _CapTP connection_ per pair of vats. The process of contacting an object is to open a connection, or reuse an existing one, to its vat, then lookup its swiss number over the connection. This process is analogous to "download a document and then lookup the fragment identifier in it".

# Serialization #

This will be our serialization format: http://wiki.erights.org/wiki/Data-E_in_JSON