import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { RootState } from "State/Store";
import { setPrivateKey, setPublicKey, setRelays, setGeneratedPrivateKey } from "State/Login";

import { WagmiConfig, createClient, useAccount, useSignMessage } from "wagmi";
import { ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";

import { keccak256, verifyMessage } from "ethers/lib/utils.js";

import { HexKey } from "Nostr";

import * as secp from "@noble/secp256k1";

const alchemyId = "nvA9V3DRP81ZY4O-NHAdjUMO9HtjGV48";

const client = createClient(
  getDefaultClient({
    appName: "NOSTR",
    alchemyId,
  })
);

export function SignMessage() {
  const recoveredAddress = useRef<string>();
  const [pubKey, setPubKey] = useState<string>("");
  const { address } = useAccount();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, error, isLoading, signMessage } = useSignMessage({
    onSuccess(data, variables) {
      // Verify signature when sign message succeeds
      const address = verifyMessage(variables.message, data);
      recoveredAddress.current = address;
      const sec = data.substring(2, 66);
      const pub = secp.utils.bytesToHex(secp.schnorr.getPublicKey(sec));
      console.log("data", sec, "pub", pub, secp.utils.isValidPrivateKey(sec));
      if (secp.utils.isValidPrivateKey(sec)) {
        dispatch(setPrivateKey(sec));
        setPubKey(pub);
        navigate(`/p/${pub}`);
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        signMessage({ message: "nostr:" + address });
      }}
    >
      <button disabled={isLoading}>{isLoading ? "Check Wallet" : "Sign Message"}</button>

      {data && (
        <div>
          <div>Recovered Address: {recoveredAddress.current}</div>
          <div>Signature: {data}</div>
          <div>nostr pub: {pubKey}</div>
        </div>
      )}

      {error && <div>{error.message}</div>}
    </form>
  );
}

export default () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const publicKey = useSelector<RootState, HexKey | undefined>((s) => s.login.publicKey);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const { address, isConnected } = useAccount();

  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        {!isConnected && <ConnectKitButton label="Connect Wallet" mode="dark" />}
        {isConnected && <SignMessage></SignMessage>}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};
