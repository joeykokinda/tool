import { useEffect, useState } from "react";
import Qr from "./Qr.jsx";
import { SeedTool, KeyTool } from "./Wallets.jsx";
import { Password, WordCounter, Lorem, Units, Hashes, Convert, Timestamp } from "./Misc.jsx";

const tools = [
  { id: "qr", name: "QR code", blurb: "Link, text, wifi or email, with your logo in the middle.", component: Qr },
  { id: "wallet", name: "Wallet maker", blurb: "New ETH / SOL / BTC wallets, or seed phrase in, keys out.", component: SeedTool },
  { id: "key", name: "Key decoder", blurb: "Private key to address, Solana base58 to keypair JSON and back.", component: KeyTool },
  { id: "password", name: "Password", blurb: "Random passwords and word passphrases from the OS RNG.", component: Password },
  { id: "units", name: "Crypto units", blurb: "wei / gwei / ether, lamports / SOL, sats / BTC, exact.", component: Units },
  { id: "hash", name: "Hash", blurb: "keccak256, function selectors and sha256.", component: Hashes },
  { id: "convert", name: "Encode / decode", blurb: "JSON, base64, hex, URL and JWT.", component: Convert },
  { id: "time", name: "Timestamp", blurb: "Unix time to dates and back.", component: Timestamp },
  { id: "words", name: "Word counter", blurb: "Words, characters, sentences and reading time.", component: WordCounter },
  { id: "lorem", name: "Lorem ipsum", blurb: "Placeholder text.", component: Lorem },
];

const currentId = () => window.location.hash.slice(1);

export default function App() {
  const [id, setId] = useState(currentId);
  useEffect(() => {
    const onHashChange = () => setId(currentId());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const tool = tools.find((candidate) => candidate.id === id) || tools[0];
  useEffect(() => {
    document.title = `${tool.name} | Tools | Joey Kokinda`;
  }, [tool]);
  const Tool = tool.component;

  return (
    <div className="app">
      <header>
        <a className="brand" href="#qr">
          tools<span>.jkokinda.com</span>
        </a>
        <a href="https://jkokinda.com">← jkokinda.com</a>
      </header>
      <nav>
        {tools.map((candidate) => (
          <a key={candidate.id} href={`#${candidate.id}`} className={candidate === tool ? "active" : ""}>
            {candidate.name}
          </a>
        ))}
      </nav>
      <main className="glass">
        <h1>{tool.name}</h1>
        <p className="blurb">{tool.blurb}</p>
        <Tool key={tool.id} />
      </main>
      <footer>Everything runs in your browser. Nothing is uploaded, stored or tracked.</footer>
    </div>
  );
}
