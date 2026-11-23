import { useState } from "react";
import { Field, Check, Output, CopyButton, randomInt } from "./ui.jsx";
import { wordlist, bytesToHex, hexToBytes, keccak_256, sha256 } from "./wallet.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const charsets = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};
const ambiguous = /[Il1O0o]/g;

function makePassword(options) {
  if (options.words) {
    const picked = Array.from({ length: options.wordCount }, () => wordlist[randomInt(wordlist.length)]);
    return { value: picked.join(options.separator), bits: options.wordCount * Math.log2(wordlist.length) };
  }
  let pool = Object.keys(charsets)
    .filter((name) => options[name])
    .map((name) => charsets[name])
    .join("");
  if (options.noAmbiguous) pool = pool.replace(ambiguous, "");
  if (!pool) return { value: "", bits: 0 };
  const value = Array.from({ length: options.length }, () => pool[randomInt(pool.length)]).join("");
  return { value, bits: options.length * Math.log2(pool.length) };
}

export function Password() {
  const [options, setOptions] = useState({
    words: false,
    length: 24,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    noAmbiguous: false,
    wordCount: 6,
    separator: "-",
  });
  const [result, setResult] = useState(() => makePassword(options));
  const change = (patch) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setResult(makePassword(next));
  };
  const toggle = (key) => (checked) => change({ [key]: checked });

  return (
    <>
      <div className="big-output">
        <code>{result.value || "pick at least one character set"}</code>
      </div>
      <div className="row">
        <button type="button" onClick={() => setResult(makePassword(options))}>
          Regenerate
        </button>
        <CopyButton text={result.value} />
        <span className="muted">{Math.round(result.bits)} bits of entropy</span>
      </div>
      <div className="tabs">
        <button type="button" className={options.words ? "" : "active"} onClick={() => change({ words: false })}>
          characters
        </button>
        <button type="button" className={options.words ? "active" : ""} onClick={() => change({ words: true })}>
          words
        </button>
      </div>
      {options.words ? (
        <div className="grid">
          <Field label={`Words ${options.wordCount}`}>
            <input type="range" min="3" max="12" value={options.wordCount} onChange={(event) => change({ wordCount: Number(event.target.value) })} />
          </Field>
          <Field label="Separator">
            <input value={options.separator} onChange={(event) => change({ separator: event.target.value })} />
          </Field>
        </div>
      ) : (
        <div className="grid">
          <Field label={`Length ${options.length}`} wide>
            <input type="range" min="8" max="128" value={options.length} onChange={(event) => change({ length: Number(event.target.value) })} />
          </Field>
          <Check label="a-z" checked={options.lower} onChange={toggle("lower")} />
          <Check label="A-Z" checked={options.upper} onChange={toggle("upper")} />
          <Check label="0-9" checked={options.digits} onChange={toggle("digits")} />
          <Check label="Symbols" checked={options.symbols} onChange={toggle("symbols")} />
          <Check label="Skip look-alikes (I l 1 O 0 o)" checked={options.noAmbiguous} onChange={toggle("noAmbiguous")} />
        </div>
      )}
    </>
  );
}

export function WordCounter() {
  const [text, setText] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const stats = [
    ["Words", words],
    ["Characters", [...text].length],
    ["No spaces", [...text.replace(/\s/g, "")].length],
    ["Sentences", (text.match(/[^.!?\s][^.!?]*[.!?]+|[^.!?\s][^.!?]*$/g) || []).length],
    ["Paragraphs", text.split(/\n\s*\n/).filter((block) => block.trim()).length],
    ["Lines", text ? text.split("\n").length : 0],
    ["Reading time", `${Math.max(words ? 1 : 0, Math.round(words / 230))} min`],
  ];
  return (
    <>
      <div className="stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <textarea rows={16} value={text} onChange={(event) => setText(event.target.value)} placeholder="Type or paste text" autoFocus />
    </>
  );
}

const loremWords =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(
    " ",
  );
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function makeLorem(paragraphs, sentences) {
  const sentence = () => {
    const words = Array.from({ length: 6 + Math.floor(Math.random() * 10) }, () => pick(loremWords));
    return words[0][0].toUpperCase() + words.join(" ").slice(1) + ".";
  };
  const blocks = Array.from({ length: paragraphs }, () => Array.from({ length: sentences }, sentence).join(" "));
  blocks[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + blocks[0].split(". ").slice(1).join(". ");
  return blocks.join("\n\n").trim();
}

export function Lorem() {
  const [paragraphs, setParagraphs] = useState(3);
  const [sentences, setSentences] = useState(5);
  const [text, setText] = useState(() => makeLorem(3, 5));
  const regenerate = (nextParagraphs, nextSentences) => {
    setParagraphs(nextParagraphs);
    setSentences(nextSentences);
    setText(makeLorem(nextParagraphs, nextSentences));
  };
  return (
    <>
      <div className="grid">
        <Field label={`Paragraphs ${paragraphs}`}>
          <input type="range" min="1" max="20" value={paragraphs} onChange={(event) => regenerate(Number(event.target.value), sentences)} />
        </Field>
        <Field label={`Sentences each ${sentences}`}>
          <input type="range" min="1" max="12" value={sentences} onChange={(event) => regenerate(paragraphs, Number(event.target.value))} />
        </Field>
      </div>
      <div className="row">
        <button type="button" onClick={() => regenerate(paragraphs, sentences)}>
          Regenerate
        </button>
        <CopyButton text={text} />
        <span className="muted">{text.split(/\s+/).length} words</span>
      </div>
      <textarea rows={16} value={text} readOnly />
    </>
  );
}

const unitGroups = [
  { name: "Ethereum", units: [["wei", 0], ["gwei", 9], ["ether", 18]] },
  { name: "Solana", units: [["lamports", 0], ["SOL", 9]] },
  { name: "Bitcoin", units: [["sats", 0], ["BTC", 8]] },
];

// Exact decimal-string math, floats would lose wei
function toBaseUnits(text, decimals) {
  const match = /^(\d*)\.?(\d*)$/.exec(text.trim().replace(/[,_\s]/g, ""));
  if (!match || !(match[1] + match[2])) return null;
  if (match[2].length > decimals && /[1-9]/.test(match[2].slice(decimals))) return null;
  return BigInt(match[1] + match[2].slice(0, decimals).padEnd(decimals, "0"));
}

function fromBaseUnits(amount, decimals) {
  const digits = amount.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, "") : "";
  return fraction ? `${whole}.${fraction}` : whole;
}

export function Units() {
  const [edit, setEdit] = useState({ group: "Ethereum", unit: "ether", text: "1" });
  return unitGroups.map((group) => {
    const active = edit.group === group.name;
    const base = active ? toBaseUnits(edit.text, Object.fromEntries(group.units)[edit.unit]) : null;
    return (
      <section key={group.name}>
        <h3>{group.name}</h3>
        <div className="grid">
          {group.units.map(([unit, decimals]) => (
            <Field key={unit} label={unit}>
              <input
                inputMode="decimal"
                value={active && edit.unit === unit ? edit.text : base === null ? "" : fromBaseUnits(base, decimals)}
                onChange={(event) => setEdit({ group: group.name, unit, text: event.target.value })}
              />
            </Field>
          ))}
        </div>
        {active && edit.text.trim() && base === null && <p className="error">Not a valid {edit.unit} amount.</p>}
      </section>
    );
  });
}

export function Hashes() {
  const [text, setText] = useState("transfer(address,uint256)");
  const [isHex, setIsHex] = useState(false);
  let bytes = null;
  try {
    bytes = isHex ? hexToBytes(text.trim().replace(/^0x/i, "").toLowerCase()) : encoder.encode(text);
  } catch {
    bytes = null;
  }
  const keccak = bytes && "0x" + bytesToHex(keccak_256(bytes));
  return (
    <>
      <div className="grid">
        <Field label="Input" wide>
          <textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
        </Field>
        <Check label="Input is hex bytes" checked={isHex} onChange={setIsHex} />
      </div>
      {bytes ? (
        <div className="account">
          <Output label="keccak256" value={keccak} />
          <Output label="Selector" value={keccak.slice(0, 10)} />
          <Output label="sha256" value={"0x" + bytesToHex(sha256(bytes))} />
          <Output label="Bytes" value={String(bytes.length)} />
        </div>
      ) : (
        <p className="error">Not valid hex.</p>
      )}
    </>
  );
}

const bytesToBase64 = (bytes) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
const base64ToBytes = (text) => {
  const normalized = text.trim().replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
};
const pretty = (value) => JSON.stringify(value, null, 2);

const conversions = {
  "JSON format": (text) => pretty(JSON.parse(text)),
  "JSON minify": (text) => JSON.stringify(JSON.parse(text)),
  "Base64 encode": (text) => bytesToBase64(encoder.encode(text)),
  "Base64 decode": (text) => decoder.decode(base64ToBytes(text)),
  "Hex encode": (text) => "0x" + bytesToHex(encoder.encode(text)),
  "Hex decode": (text) => decoder.decode(hexToBytes(text.trim().replace(/^0x/i, "").toLowerCase())),
  "URL encode": (text) => encodeURIComponent(text),
  "URL decode": (text) => decodeURIComponent(text),
  "JWT decode": (text) => {
    const [header, payload] = text.trim().split(".");
    const part = (segment) => JSON.parse(decoder.decode(base64ToBytes(segment)));
    return pretty({ header: part(header), payload: part(payload) }) + "\n\n(signature not verified)";
  },
};

export function Convert() {
  const [operation, setOperation] = useState("JSON format");
  const [text, setText] = useState("");
  let output = "";
  let error = "";
  if (text) {
    try {
      output = conversions[operation](text);
    } catch (caught) {
      error = caught.message;
    }
  }
  return (
    <>
      <div className="tabs">
        {Object.keys(conversions).map((name) => (
          <button key={name} type="button" className={operation === name ? "active" : ""} onClick={() => setOperation(name)}>
            {name}
          </button>
        ))}
      </div>
      <textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} placeholder="Input" spellCheck={false} autoFocus />
      {error && <p className="error">{error}</p>}
      <div className="row">
        <CopyButton text={output} label="Copy output" />
      </div>
      <textarea rows={10} value={output} readOnly placeholder="Output" />
    </>
  );
}

function parseTime(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const number = Number(trimmed);
    // 1e11 seconds is the year 5138, so anything bigger is milliseconds
    return new Date(Math.abs(number) < 1e11 ? number * 1000 : number);
  }
  return new Date(trimmed);
}

export function Timestamp() {
  const [text, setText] = useState(() => String(Math.floor(Date.now() / 1000)));
  const date = parseTime(text);
  const valid = date && !Number.isNaN(date.getTime());
  const relative = () => {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [unit, size] of [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]])
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    return format.format(seconds, "second");
  };
  return (
    <>
      <div className="grid">
        <Field label="Unix seconds, milliseconds, or any date string" wide>
          <input value={text} onChange={(event) => setText(event.target.value)} autoFocus />
        </Field>
      </div>
      <div className="row">
        <button type="button" onClick={() => setText(String(Math.floor(Date.now() / 1000)))}>
          Now
        </button>
      </div>
      {valid ? (
        <div className="account">
          <Output label="Seconds" value={String(Math.floor(date.getTime() / 1000))} />
          <Output label="Millis" value={String(date.getTime())} />
          <Output label="ISO (UTC)" value={date.toISOString()} />
          <Output label="Local" value={date.toString()} />
          <Output label="Relative" value={relative()} />
        </div>
      ) : (
        text.trim() && <p className="error">Could not read that as a time.</p>
      )}
    </>
  );
}
