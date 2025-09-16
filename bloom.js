// bloom.js
const SHA256 = require('crypto-js/sha256');

class BloomFilter {
  constructor(m = 2048, k = 4) {
    this.m = m;
    this.k = k;
    this.bits = new Uint8Array(m);
  }
  _hashes(s) {
    const a = SHA256(String(s)).toString();
    const b = SHA256(a).toString();
    const out = [];
    for (let i = 0; i < this.k; i++) {
      const mix = SHA256(a + ':' + i + ':' + b).toString();
      const idx = parseInt(mix.slice(0, 8), 16) % this.m;
      out.push(idx);
    }
    return out;
  }
  add(s) {
    for (const i of this._hashes(s)) this.bits[i] = 1;
  }
  mayContain(s) {
    return this._hashes(s).every(i => this.bits[i] === 1);
  }
  serialize() {
    return { m: this.m, k: this.k, bits: Array.from(this.bits) };
  }
  static deserialize(obj) {
    const bf = new BloomFilter(obj.m, obj.k);
    bf.bits = Uint8Array.from(obj.bits);
    return bf;
  }
}

module.exports = { BloomFilter };
