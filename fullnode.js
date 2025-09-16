// fullnode.js
const Blockchain = require('./blockChain');
const { transactions } = require('./blockChain');
const { BloomFilter } = require('./bloom');
const { buildProof } = require('./merkle');

class FullNode {
  constructor() {
    this.chain = new Blockchain();
    this.blockBlooms = new Map(); // height -> serialized bloom
  }

  get height() {
    return this.chain.chain.length - 1;
  }

  // Build bloom for a given block height (txId + toAddress)
  _buildBloomForHeight(h) {
    const b = this.chain.chain[h];
    if (!b) return;
    const bf = new BloomFilter(2048, 4);
    for (const t of b.transactions) {
      bf.add(t.txId);
      if (t.toAddress) bf.add(t.toAddress);
    }
    this.blockBlooms.set(h, bf.serialize());
  }

  // Public RPC-ish API
  submitTransaction(tx) {
    this.chain.addTransaction(tx);
  }

  mine(minerAddress) {
    const prevHeight = this.height;
    this.chain.minePendingTransactions(minerAddress);
    const newHeight = this.height;
    if (newHeight > prevHeight) {
      this._buildBloomForHeight(newHeight);
    }
  }

  getBlockHeader(height) {
    const b = this.chain.chain[height];
    if (!b) return null;
    return {
      height,
      hash: b.hash,
      previousHash: b.previousHash,
      merkleRoot: b.merkleRoot,
      timestamp: b.timestamp,
      txCount: b.transactions.length
    };
  }

  getBloom(height) {
    return this.blockBlooms.get(height) || null;
  }

  // Helper: txIds paying to address in a specific block (for demo)
  findTxIdsForAddress(height, address) {
    const b = this.chain.chain[height];
    if (!b) return [];
    return b.transactions.filter(t => t.toAddress === address).map(t => t.txId);
  }

  getMerkleProof(height, txId) {
    const b = this.chain.chain[height];
    if (!b) return null;
    return buildProof(b.txIds, txId);
  }

  // Airdrop convenience: push a block with coinbase-like transfers (no fees)
  airdrop(addresses, amount) {
    const { Block } = require('./blockChain');
    const txs = addresses.map(addr => {
      const tx = new transactions(null, addr, amount);
      tx.baseFee = 0; tx.priorityFee = 0; // no fees on airdrop
      return tx;
    });
    const stripped = txs.map(tx => this.chain.stripTransactions(tx));
    const block = new Block(this.chain.getLatestBlock().hash, Date.now(), stripped);
    block.mineBlock(this.chain.difficulty);
    this.chain.chain.push(block);
    this._buildBloomForHeight(this.height);
    return block.hash;
  }
}

module.exports = { FullNode };
