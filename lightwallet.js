// lightwallet.js
const { BloomFilter } = require('./bloom');
const { verifyProof } = require('./merkle');

class LightWallet {
  constructor(address, fullNode) {
    this.address = address;
    this.node = fullNode;
    this.headers = [];         // block headers only
    this.confirmedTxs = new Set();
    this.balance = 0;          // incoming only (כארנק קל)
  }

  syncHeaders() {
    const tip = this.node.height;
    for (let h = this.headers.length; h <= tip; h++) {
      const hdr = this.node.getBlockHeader(h);
      if (hdr) this.headers.push(hdr);
    }
  }

  // Scan new headers: Bloom → fetch txIds → Merkle proof → verify → update balance
  scanNewBlocks() {
    for (let h = 0; h < this.headers.length; h++) {
      const hdr = this.headers[h];
      const bloomSer = this.node.getBloom(h);
      if (!bloomSer) continue;

      const bloom = BloomFilter.deserialize(bloomSer);
      if (!bloom.mayContain(this.address)) continue;

      const candidateTxIds = this.node.findTxIdsForAddress(h, this.address);
      for (const txId of candidateTxIds) {
        if (!bloom.mayContain(txId)) continue;

        const proof = this.node.getMerkleProof(h, txId);
        if (!proof) continue;

        const ok = verifyProof(txId, proof, hdr.merkleRoot);
        if (ok && !this.confirmedTxs.has(txId)) {
          this.confirmedTxs.add(txId);

          // credit amount (לצורך הדמו—ניגש לבלוק ב-node לקרוא סכום)
          const block = this.node.chain.chain[h];
          const t = block.transactions.find(t => t.txId === txId);
          if (t && t.toAddress === this.address) {
            this.balance += t.amount;
          }
        }
      }
    }
  }
}

module.exports = { LightWallet };
