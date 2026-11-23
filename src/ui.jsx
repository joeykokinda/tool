import { useState } from "react";

export function Field({ label, children, wide }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button type="button" className="small" onClick={copy} disabled={!text}>
      {copied ? "Copied" : label}
    </button>
  );
}

export function Output({ label, value, secret, revealed }) {
  return (
    <div className="output">
      <span className="output-label">{label}</span>
      <code className={secret && !revealed ? "blurred" : ""}>{value}</code>
      <CopyButton text={value} />
    </div>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

// Unbiased integer in [0, max) from the OS CSPRNG
export function randomInt(max) {
  const limit = Math.floor(2 ** 32 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limit);
  return buffer[0] % max;
}
