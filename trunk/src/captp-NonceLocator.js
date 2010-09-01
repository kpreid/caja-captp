"use cajita";
// Copyright 2002 Combex, Inc. under the terms of the MIT X license
// found at http://www.opensource.org/licenses/mit-license.html ...............

/**
 * Made magically available at incoming position 0.
 * <p/>
 * Used to resolve 3-vat live Granovetter introductions, and to log tracing
 * info sent from the other vat.
 * 
 * Note that myOwnID is the *remote* vat's ID.
 *
 * @author Kevin Reid, after Mark S. Miller's Java code from E-on-Java
 */
function NonceLocator(myPGifts, myNGifts, myOwnID, myHub, mySwissTable) {
  //myPGifts = PromiseGiftTableT.coerce(myPGifts);
  //myNGifts = NearGiftTableT.coerce(myNGifts);
  myOwnID = VatID.T.coerce(myOwnID);
  //myHub = PeerHubT.coerce(myHub);
  //mySwissTable = SwissTableT.coerce(mySwissTable);

  return cajita.freeze({
    toString: function () {
      return "[NonceLocator for vat " + myOwnID + "]";
    },
    
    provideFor: function (gift, recipID, nonce) {
      recipID = VatID.T.coerce(recipID);
      nonce = NonceT.coerce(nonce);
      return myPGifts.provideFor(gift, recipID, nonce);
    },

    provideFor: function (gift, recipID, nonce, swissHash) {
      recipID = VatID.T.coerce(recipID);
      nonce = NonceT.coerce(nonce);
      swissHash = Swiss.T.coerce(swissHash);
      
      cajita.enforce(Ref.isNear(gift), "Must be Near: ", gift);
      //If gift isn't Selfish, this will throw an exception,
      //which is as it should be.
      var giftSwiss = mySwissTable.getIdentity(gift);
      var giftHash = Swiss.hash(giftSwiss);
      cajita.enforce(giftHash === swissHash, "wrong hash: ", swissHash);
      return myNGifts.provideFor(gift, recipID, nonce, swissHash);
    },

    /**
     * @param donorID    The vatID of the vat (Alice, the gift giver) that
     *                   provided the gift we're picking up.
     * @param nonce      Identifies (together with myOwnID) the gift in the
     *                   donor's table.
     * @param optFarVine Justs hold onto it until the request is done, to
     *                   prevent it from being gced.
     */
    acceptFrom: function (donorPath, donorID, nonce, optFarVine) {
      donorPath = SearchPathT.coerce(donorPath);
      donorID = VatID.T.coerce(donorID);
      nonce = NonceT.coerce(nonce);
      
      var optDonorConn = myHub.get(donorPath, donorID);
      // XXX hub.get can never yield null -- what was the old-CapTP situation in which this could occur?
      if (null === optDonorConn) {
        return Ref.broken("The donor is gone");
      }
      var donorTable = optDonorConn.getPromiseGiftTable();
      return donorTable.acceptFor(myOwnID, nonce);
    },

    /**
     * @param donorID    The vatID of the vat (Alice, the gift giver) that
     *                   provided the gift we're picking up.
     * @param nonce      Identifies (together with myOwnID) the gift in the
     *                   donor's table.
     * @param swissHash  The gift should only be returned if it has this
     *                   identity. Otherwise the recipient should get a
     *                   DisconnectedRef. This isn't yet fully implemented.
     * @param optFarVine Justs hold onto it until the request is done, to
     *                   prevent it from being gced.
     */
    acceptFrom: function (donorPath, donorID, nonce, swissHash, optFarVine) {
      donorPath = SearchPathT.coerce(donorPath);
      donorID = VatID.T.coerce(donorID);
      nonce = NonceT.coerce(nonce);
      swissHash = Swiss.T.coerce(swissHash);
                  
      var optDonorConn = myHub.get(donorPath, donorID);
      // XXX hub.get can never yield null -- what was the old-CapTP situation in which this could occur?
      if (null === optDonorConn) {
        return Ref.broken("The donor is gone");
      }
      var donorTable = optDonorConn.getNearGiftTable();
      var result = donorTable.acceptFor(myOwnID, nonce, swissHash);
      if (!Ref.isNear(result)) {
        throw new Error("internal: non-near gift for " + swissHash);
      }
      //If result isn't Selfish, this will throw an exception,
      //which is as it should be.
      var id = mySwissTable.getIdentity(result);
      var idHash = Swiss.hash(id);
      if (!Swiss.same(idHash, swissHash)) {
        throw new Error("internal: hash mismatch: " + swissHash);
      }
      return result;
    },

    /**
     * Do nothing, letting the argument become garbage. <p>
     * <p/>
     * The purpose of the message is to ensure that the argument isn't garbage
     * until the message is delivered.
     */
    ignore: function (optFarVine) {},

    /**
     *
     */
    lookupSwiss: function (swissNum, optFarVine) {
      swissNum = Swiss.T.coerce(swissNum);
      
      return mySwissTable.lookupSwiss(swissNum);
    },

    /**
     * Enables our counterparty to log a message to our tracing system.
     * <p/>
     * These messages are tagged with the vatID of our counterparty.
     */
    traceRemote: function (message) {
      cajita.enforceType(message, "string");

      console.log("CapTP remote trace: ", myOwnID, ": ", message);
    }
  });
}

// exports
cajita.freeze({
  "NonceLocator": NonceLocator
});