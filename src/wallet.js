import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { base58, bech32, createBase58check } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex, hexToBytes, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export { wordlist, bytesToHex, hexToBytes, keccak_256, sha256 };

const base58check = createBase58check(sha256);

export const newMnemonic = (wordCount = 12) => generateMnemonic(wordlist, wordCount === 24 ? 256 : 128);

export const cleanMnemonic = (phrase) => phrase.trim().toLowerCase().split(/\s+/).join(" ");

export const isValidMnemonic = (phrase) => validateMnemonic(cleanMnemonic(phrase), wordlist);

export const toSeed = (phrase, passphrase = "") => mnemonicToSeedSync(cleanMnemonic(phrase), passphrase);

export function checksumAddress(addressBytes) {
  const lower = bytesToHex(addressBytes);
  const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
  return "0x" + [...lower].map((char, index) => (parseInt(hash[index], 16) >= 8 ? char.toUpperCase() : char)).join("");
}

export function ethFromPrivateKey(privateKey) {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  return {
    path: "",
    address: checksumAddress(keccak_256(publicKey.slice(1)).slice(-20)),
    privateKey: "0x" + bytesToHex(privateKey),
  };
}

export function ethAccount(seed, index = 0) {
  const path = `m/44'/60'/0'/0/${index}`;
  return { ...ethFromPrivateKey(HDKey.fromMasterSeed(seed).derive(path).privateKey), path };
}

export function solFromSeed32(seed32) {
  const publicKey = ed25519.getPublicKey(seed32);
  const secretKey = concatBytes(seed32, publicKey);
  return {
    path: "",
    address: base58.encode(publicKey),
    privateKey: base58.encode(secretKey),
    keypairJson: JSON.stringify([...secretKey]),
  };
}

// SLIP-0010 ed25519: hardened-only derivation
function slip10(seed, indexes) {
  let node = hmac(sha512, utf8ToBytes("ed25519 seed"), seed);
  for (const index of indexes) {
    const data = new Uint8Array(37);
    data.set(node.slice(0, 32), 1);
    new DataView(data.buffer).setUint32(33, (index | 0x80000000) >>> 0);
    node = hmac(sha512, node.slice(32), data);
  }
  return node.slice(0, 32);
}

// scheme "phantom": m/44'/501'/index'/0' (Phantom, Solflare, Backpack)
// scheme "cli": solana-keygen default, first 32 bytes of the seed, no path
export function solAccount(seed, index = 0, scheme = "phantom") {
  if (scheme === "cli") return { ...solFromSeed32(seed.slice(0, 32)), path: "solana-keygen (no path)" };
  return { ...solFromSeed32(slip10(seed, [44, 501, index, 0])), path: `m/44'/501'/${index}'/0'` };
}

export function btcAccount(seed, index = 0) {
  const path = `m/84'/0'/0'/0/${index}`;
  const node = HDKey.fromMasterSeed(seed).derive(path);
  const witnessProgram = ripemd160(sha256(node.publicKey));
  return {
    path,
    address: bech32.encode("bc", [0, ...bech32.toWords(witnessProgram)]),
    privateKey: base58check.encode(concatBytes(Uint8Array.of(0x80), node.privateKey, Uint8Array.of(0x01))),
  };
}

// Accepts an ETH hex key, or a Solana secret as base58 or a JSON byte array (32 or 64 bytes)
export function decodePrivateKey(input) {
  const text = input.trim();
  if (!text) return null;
  const hex = text.replace(/^0x/i, "");
  if (/^[0-9a-f]{64}$/i.test(hex)) return { chain: "Ethereum", ...ethFromPrivateKey(hexToBytes(hex.toLowerCase())) };
  const bytes = text.startsWith("[") ? Uint8Array.from(JSON.parse(text)) : base58.decode(text);
  if (bytes.length !== 32 && bytes.length !== 64) throw new Error(`expected 32 or 64 bytes, got ${bytes.length}`);
  const account = solFromSeed32(bytes.slice(0, 32));
  if (bytes.length === 64 && base58.encode(bytes.slice(32)) !== account.address)
    throw new Error("public key half does not match the secret half");
  return { chain: "Solana", ...account };
}
