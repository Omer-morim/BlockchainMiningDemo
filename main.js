// main.js
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const { FullNode } = require('./fullnode');
const { transactions } = require('./blockChain');
const { TXS_PER_BLOCK } = require('./config');

// --- Generate keys/addresses
const minerKey = ec.genKeyPair(); const miner = minerKey.getPublic('hex');
const w1Key = ec.genKeyPair();    const w1    = w1Key.getPublic('hex');
const w2Key = ec.genKeyPair();    const w2    = w2Key.getPublic('hex');

// --- Start full node (also a miner)
const node = new FullNode();

// --- Airdrop 300 to each wallet (as per assignment)
node.airdrop([miner, w1, w2], 300);

// --- Create 2 light wallets connected to the full node
const { LightWallet } = require('./lightwallet');
const lw1 = new LightWallet(w1, node);
const lw2 = new LightWallet(w2, node);

// --- Submit a couple of signed transactions into mempool
const tx1 = new transactions(w1, w2, 20);  // w1 -> w2
tx1.signTransaction(w1Key);
node.submitTransaction(tx1);

const tx2 = new transactions(w2, w1, 10);  // w2 -> w1
tx2.signTransaction(w2Key);
node.submitTransaction(tx2);

// --- Mine: full node packs up to (TXS_PER_BLOCK-1) + coinbase
node.mine(miner);

// --- Light wallets sync headers and verify inclusion via Bloom + Merkle
lw1.syncHeaders(); lw1.scanNewBlocks();
lw2.syncHeaders(); lw2.scanNewBlocks();

// --- Print balances (light wallets track incoming credits; full balances via full node)
console.log('--- Light wallets (incoming credits only) ---');
console.log('LW1 address:', w1, 'incoming balance:', lw1.balance);
console.log('LW2 address:', w2, 'incoming balance:', lw2.balance);

console.log('--- Full node on-chain balances ---');
console.log('Miner:', node.chain.getBalanceOfAddress(miner));
console.log('W1   :', node.chain.getBalanceOfAddress(w1));
console.log('W2   :', node.chain.getBalanceOfAddress(w2));

console.log('Totals:',
  'totalMined=', node.chain.totalMined,
  'totalBurned=', node.chain.totalBurned
);

// --- Supply audit (sanity check)
function auditSupply(chain) {
  // Collect all addresses that appear on-chain
  const addrs = new Set();
  for (const b of chain.chain) {
    for (const t of b.transactions || []) {
      if (t.fromAddress) addrs.add(t.fromAddress);
      if (t.toAddress) addrs.add(t.toAddress);
    }
  }
  // Sum balances across all observed addresses
  let sumBalances = 0;
  for (const a of addrs) sumBalances += chain.getBalanceOfAddress(a);

  // Expected supply = initial airdrop (3 * 300) + mined - burned
  const expected = 900 + chain.totalMined - chain.totalBurned;
  console.log('AUDIT: sumBalances=', sumBalances, ' expectedSupply=', expected);
}

// Run audit
auditSupply(node.chain);
