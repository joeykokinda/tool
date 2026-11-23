import { useMemo, useState } from "react";
import { Field, Check, Output } from "./ui.jsx";
import { newMnemonic, isValidMnemonic, toSeed, ethAccount, solAccount, btcAccount, decodePrivateKey } from "./wallet.js";

// One box takes anything: several words are a seed phrase, a single token or a JSON array is a private key
function decode(input, passphrase, count, solScheme) {
  const text = input.trim();
  if (!text) return { kind: "empty", chains: [] };
  const words = text.split(/\s+/);
  if (words.length === 1 || text.startsWith("[")) {
    try {
      const { chain, ...account } = decodePrivateKey(text);
      return { kind: "key", chains: [{ name: chain, accounts: [account] }] };
    } catch {
      return { kind: "key", chains: [], error: "Not a seed phrase or a private key I recognise (ETH hex, Solana base58 or keypair JSON, Bitcoin WIF)." };
    }
  }
  if (!isValidMnemonic(text))
    return { kind: "seed", chains: [], error: `Not a valid seed phrase (${words.length} words): check spelling, word count and order.` };
  const seed = toSeed(text, passphrase);
  const indexes = [...Array(count).keys()];
  return {
    kind: "seed",
    chains: [
      { name: "Ethereum / EVM", accounts: indexes.map((index) => ethAccount(seed, index)) },
      { name: "Solana", accounts: (solScheme === "cli" ? [0] : indexes).map((index) => solAccount(seed, index, solScheme)) },
      { name: "Bitcoin (native segwit)", accounts: indexes.map((index) => btcAccount(seed, index)) },
    ],
  };
}

export default function Wallets() {
  const [input, setInput] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [count, setCount] = useState(1);
  const [solScheme, setSolScheme] = useState("phantom");
  const [revealed, setRevealed] = useState(false);

  const result = useMemo(() => decode(input, passphrase, count, solScheme), [input, passphrase, count, solScheme]);

  return (
    <>
      <p className="warning">
        Keys are made and decoded in this tab only. The page sends nothing anywhere (its CSP blocks every outbound request) and keeps
        working offline. Still, treat any phrase you type into a browser as hot: use it for dev and burner wallets, not cold storage.
      </p>
      <div className="row">
        <button type="button" onClick={() => setInput(newMnemonic(12))}>
          New 12 word wallet
        </button>
        <button type="button" onClick={() => setInput(newMnemonic(24))}>
          New 24 word wallet
        </button>
        <Check label="Show secrets" checked={revealed} onChange={setRevealed} />
      </div>
      <div className="grid">
        <Field label="Seed phrase or private key (ETH hex, Solana base58 or keypair JSON, Bitcoin WIF)" wide>
          <textarea
            rows={3}
            className={revealed ? "" : "blurred"}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            autoFocus
          />
        </Field>
        {result.kind === "seed" && (
          <>
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
          </>
        )}
      </div>
      {result.error && <p className="error">{result.error}</p>}
      {result.chains.map((chain) => (
        <section key={chain.name}>
          <h3>{chain.name}</h3>
          {chain.accounts.map((account) => (
            <div className="account" key={account.path}>
              {account.path && <span className="path">{account.path}</span>}
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
