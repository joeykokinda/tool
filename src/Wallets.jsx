import { useMemo, useState } from "react";
import { Field, Check, Output } from "./ui.jsx";
import { newMnemonic, isValidMnemonic, toSeed, ethAccount, solAccount, btcAccount, decodePrivateKey } from "./wallet.js";

const Warning = () => (
  <p className="warning">
    Keys are made and decoded in this tab only. The page sends nothing anywhere (its CSP blocks every outbound request) and keeps
    working offline. Still, treat any phrase you type into a browser as hot: use it for dev and burner wallets, not cold storage.
  </p>
);

export function SeedTool() {
  const [phrase, setPhrase] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [count, setCount] = useState(1);
  const [solScheme, setSolScheme] = useState("phantom");
  const [revealed, setRevealed] = useState(false);

  const wordCount = phrase.trim() ? phrase.trim().split(/\s+/).length : 0;
  const valid = wordCount > 0 && isValidMnemonic(phrase);

  const chains = useMemo(() => {
    if (!valid) return [];
    const seed = toSeed(phrase, passphrase);
    const indexes = [...Array(count).keys()];
    return [
      { name: "Ethereum / EVM", accounts: indexes.map((index) => ethAccount(seed, index)) },
      { name: "Solana", accounts: (solScheme === "cli" ? [0] : indexes).map((index) => solAccount(seed, index, solScheme)) },
      { name: "Bitcoin (native segwit)", accounts: indexes.map((index) => btcAccount(seed, index)) },
    ];
  }, [valid, phrase, passphrase, count, solScheme]);

  return (
    <>
      <Warning />
      <div className="row">
        <button type="button" onClick={() => setPhrase(newMnemonic(12))}>
          New 12 word wallet
        </button>
        <button type="button" onClick={() => setPhrase(newMnemonic(24))}>
          New 24 word wallet
        </button>
        <Check label="Show secrets" checked={revealed} onChange={setRevealed} />
      </div>
      <div className="grid">
        <Field label="Seed phrase (generate one, or type yours to get its keys)" wide>
          <textarea
            rows={3}
            className={revealed ? "" : "blurred"}
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
          />
        </Field>
        <Field label="BIP39 passphrase (optional)">
          <input type={revealed ? "text" : "password"} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="off" />
        </Field>
        <Field label="Accounts">
          <input type="number" min="1" max="20" value={count} onChange={(event) => setCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} />
        </Field>
        <Field label="Solana derivation">
          <select value={solScheme} onChange={(event) => setSolScheme(event.target.value)}>
            <option value="phantom">Phantom / Solflare / Backpack</option>
            <option value="cli">solana-keygen (no path)</option>
          </select>
        </Field>
      </div>
      {wordCount > 0 && !valid && <p className="error">Not a valid BIP39 phrase ({wordCount} words): check spelling, word count and order.</p>}
      {chains.map((chain) => (
        <section key={chain.name}>
          <h3>{chain.name}</h3>
          {chain.accounts.map((account) => (
            <div className="account" key={account.path}>
              <span className="path">{account.path}</span>
              <Output label="Address" value={account.address} />
              <Output label="Private key" value={account.privateKey} secret revealed={revealed} />
              {account.keypairJson && <Output label="Keypair JSON" value={account.keypairJson} secret revealed={revealed} />}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

export function KeyTool() {
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);

  let account = null;
  let error = "";
  try {
    account = decodePrivateKey(input);
  } catch (caught) {
    error = "Not a recognised key: " + caught.message;
  }

  return (
    <>
      <Warning />
      <div className="grid">
        <Field label="Private key: ETH hex, or Solana base58 / keypair JSON array" wide>
          <textarea rows={3} className={revealed ? "" : "blurred"} value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false} autoComplete="off" />
        </Field>
        <Check label="Show secrets" checked={revealed} onChange={setRevealed} />
      </div>
      {error && <p className="error">{error}</p>}
      {account && (
        <div className="account">
          <span className="path">{account.chain}</span>
          <Output label="Address" value={account.address} />
          <Output label="Private key" value={account.privateKey} secret revealed={revealed} />
          {account.keypairJson && <Output label="Keypair JSON" value={account.keypairJson} secret revealed={revealed} />}
        </div>
      )}
    </>
  );
}
