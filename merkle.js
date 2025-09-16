// merkle.js
const SHA256 = require('crypto-js/sha256');

function computeRoot(txIds) {
  if (!txIds || txIds.length === 0) return '0'.repeat(64);
  let level = txIds.slice();
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(SHA256(level[i] + level[i + 1]).toString());
    }
    level = next;
  }
  return level[0];
}

function buildProof(txIds, targetTxId) {
  const startIndex = txIds.indexOf(targetTxId);
  if (startIndex === -1) return null;

  let index = startIndex;
  let level = txIds.slice();
  const proof = [];

  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const isRight = index % 2 === 1;
    const pairIndex = isRight ? index - 1 : index + 1;
    const sibling = level[pairIndex];
    proof.push({ position: isRight ? 'left' : 'right', hash: sibling });

    // build next level
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(SHA256(level[i] + level[i + 1]).toString());
    }
    level = next;
    index = Math.floor(index / 2);
  }
  return proof;
}

function verifyProof(txId, proof, root) {
  let h = txId;
  for (const step of proof) {
    h = step.position === 'left'
      ? SHA256(step.hash + h).toString()
      : SHA256(h + step.hash).toString();
  }
  return h === root;
}

module.exports = { computeRoot, buildProof, verifyProof };
