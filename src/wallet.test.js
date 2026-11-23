import assert from "node:assert/strict";
import { toSeed, isValidMnemonic, newMnemonic, ethAccount, solAccount, btcAccount, decodePrivateKey } from "./wallet.js";

const abandon = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const anvil = "test test test test test test test test test test test junk";

// anvil / hardhat account 0
const eth = ethAccount(toSeed(anvil), 0);
assert.equal(eth.address, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
assert.equal(eth.privateKey, "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
assert.equal(ethAccount(toSeed(anvil), 1).address, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

// BIP84 spec vector
const btc = btcAccount(toSeed(abandon), 0);
assert.equal(btc.address, "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
assert.equal(btc.privateKey, "KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d");

// Phantom's first account for the all-abandon phrase
const sol = solAccount(toSeed(abandon), 0);
assert.equal(sol.address, "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");

assert.equal(decodePrivateKey(eth.privateKey).address, eth.address);
assert.equal(decodePrivateKey(sol.privateKey).address, sol.address);
assert.equal(decodePrivateKey(sol.keypairJson).address, sol.address);
assert.equal(decodePrivateKey(btc.privateKey).address, btc.address);
assert.throws(() => decodePrivateKey("[1,2,3]"));

assert.ok(isValidMnemonic("  Test test test test test test test test test test test JUNK "));
assert.ok(!isValidMnemonic(abandon.replace("about", "abandon")));
assert.equal(newMnemonic(24).split(" ").length, 24);
assert.ok(isValidMnemonic(newMnemonic(12)));

console.log("wallet ok");
