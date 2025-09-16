const SHA256 = require('crypto-js/sha256');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const { INITIAL_BALANCE, BLOCK_REWARD, BASE_FEE, PRIORITY_FEE, TXS_PER_BLOCK, DIFFICULTY } = require('./config');


//***************************************************** */
// transactions class represents a transaction in the blockchain
// It contains the sender's address, receiver's address, and the amount being transferred
class transactions {
  constructor(fromAddress, toAddress, amount, witness = null) {
    this.fromAddress = fromAddress;   // null coinbase in deal
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();

    this.baseFee = BASE_FEE;          // burned
    this.priorityFee = PRIORITY_FEE;  // to the miner

    this.witness = witness;           // { signature: <hex> } after signing
    this.signature = null;            //string hex
    this.txId = this.calculateTxId(); // txId without witness
    this.wtxId = null;                // after signing

    }

  getSigningPayload() {
    return JSON.stringify({
      from: this.fromAddress,
      to: this.toAddress,
      amount: this.amount,
      timestamp: this.timestamp,
      baseFee: this.baseFee,
      priorityFee: this.priorityFee
    });
  }

  calculateTxId() {
    return SHA256(this.getSigningPayload()).toString();
  }

  signTransaction(signingKey) {
    if (this.fromAddress === null) return; // coinbase: no signature needed
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets');
    }

    const hash = this.calculateTxId();
    const sigHex = signingKey.sign(hash, 'base64').toDER('hex');

    //adding witness
    this.witness = { signature: sigHex };
    this.signature = sigHex;

    // wtxId includes witness
    this.wtxId = SHA256(hash + ':' + sigHex).toString();
  }


  isValid() {
    if (this.fromAddress === null) return true; // coinbase: no signature needed
    if (!this.signature || !this.witness || !this.witness.signature) {
      throw new Error('Missing signature (witness) on this transaction');
    }
    const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
    return publicKey.verify(this.calculateTxId(), this.signature);
  }

  totalCost() {
    return this.amount + this.baseFee + this.priorityFee;
  }

  isSelfTransfer() {
    return this.fromAddress && this.toAddress && this.fromAddress === this.toAddress;
  }
}






//***************************************************** */
// Block class represents a single block in the blockchain
// It contains the block's data, timestamp, and hash of the previous block
class Block{
    constructor( previousHash = '', timestamp, transactions, hash) {
        
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.transactions = transactions
        this.txIds = transactions.map(tx => tx.txId); // List of transaction IDs in the block
        this.merkleRoot = Block.computeMerkleRoot(this.txIds);

        this.nonce = 0; // Added nonce for proof of work
        this.hash = this.calculateHash();
    }

    // Compute the Merkle root from the list of transaction IDs
    static computeMerkleRoot(txIds) {
        if (!txIds || txIds.length === 0) return '0'.repeat(64); // Empty tree
        let level  = txIds.slice(); // Copy of txIds
        while (level.length > 1) {
            if(level.length % 2 === 1) level.push(level[level.length - 1]); // Duplicate last if odd
            const nextLevel = [];
            for (let i = 0; i < level.length; i += 2) {
                nextLevel.push(SHA256(level[i] + level[i + 1]).toString());
            }
            level = nextLevel;
        }
        return level[0]; // Root hash
    }


calculateHash() {
    return SHA256(this.previousHash  + this.timestamp + this.merkleRoot + this.nonce).toString();
  }

  mineBlock(difficulty) {
   const prefix = '0'.repeat(difficulty);
    while (!this.hash.startsWith(prefix)) {
         this.nonce++;
         this.hash = this.calculateHash();
    }
    console.log(`Block mined: ${this.hash} (nonce=${this.nonce})`);

  }

// In class Block (replace the whole function)
hasValidTransactions() {
  for (const t of this.transactions) {
    if (!t || typeof t !== 'object') return false;
    if (t.fromAddress === undefined || t.toAddress === undefined) return false;
    if (typeof t.amount !== 'number') return false;
    if (!t.txId) return false;

    // Recompute txId from the stripped payload and compare
    const payload = JSON.stringify({
      from: t.fromAddress,
      to: t.toAddress,
      amount: t.amount,
      timestamp: t.timestamp,
      baseFee: t.baseFee,
      priorityFee: t.priorityFee
    });
    const recomputed = SHA256(payload).toString();
    if (recomputed !== t.txId) return false;
  }
  return true;
 }
}

//***************************************************** */
// Blockchain class represents the entire blockchain
// It contains an array of blocks, a list of pending transactions, and methods to manage the blockchain
class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = DIFFICULTY;
    this.pendingTransactions = [];
    this.mempoolTxIds = new Set();    // Track txIds in the mempool for duplicates
    this.miningReward = BLOCK_REWARD;

    this.balance = {};
    this.totalBurned = 0;
    this.totalMined = 0;
  }

  // Create the genesis (first) block in the blockchain
  stripTransactions(Transaction) {
    return {
        fromAddress: Transaction.fromAddress,
        toAddress: Transaction.toAddress,
        amount: Transaction.amount,
        baseFee: Transaction.baseFee,
        priorityFee: Transaction.priorityFee,
        timestamp: Transaction.timestamp,
        txId: Transaction.txId,
    };
  }


     

 createGenesisBlock() {
  // Genesis block has no transactions; merkleRoot will be the empty-root
  return new Block('0', Date.now(), []);
}

getLatestBlock() {
  return this.chain[this.chain.length - 1];
}

  selectTransactionsForBlock() {
    const maxRegular = Math.max(0, TXS_PER_BLOCK - 1); // Reserve 1 for coinbase
    return this.pendingTransactions.slice(0, maxRegular);
  }

minePendingTransactions(minerAddress) {
  if (!minerAddress) throw new Error('Miner address is required to receive the block reward');

  // Select up to (TXS_PER_BLOCK - 1) regular transactions from the mempool.
  // One slot is reserved for the coinbase transaction.
  const chosenTxs = this.selectTransactionsForBlock();
  if (chosenTxs.length === 0) {
    console.log('No transactions to mine');
    return;
  }

  // EIP-1559 accounting: sum base fees to burn and priority fees to reward the miner.
  let totalBaseBurn = 0;
  let totalPriorityFees = 0;
  for (const tx of chosenTxs) {
    totalBaseBurn += tx.baseFee;
    totalPriorityFees += tx.priorityFee;
  }

  // Coinbase transaction: block reward + total priority fees; no fees on coinbase.
  const coinbaseAmount = this.miningReward + totalPriorityFees;
  const coinbaseTx = new transactions(null, minerAddress, coinbaseAmount);
  coinbaseTx.baseFee = 0;
  coinbaseTx.priorityFee = 0;

  // Assemble the block transaction list and strip witness/signature for on-chain storage.
  const blockTxs = [coinbaseTx, ...chosenTxs];
  const stripped = blockTxs.map(tx => this.stripTransactions(tx));

  // Build a new block on top of the latest block; PoW over (prevHash + timestamp + merkleRoot + nonce).
  const block = new Block(this.getLatestBlock().hash, Date.now(), stripped);

  // Proof of Work: find a hash with the required difficulty prefix.
  block.mineBlock(this.difficulty);

  // Append the mined block to the chain.
  this.chain.push(block);

  // Remove included transactions from the mempool (by txId).
  const includedIds = new Set(chosenTxs.map(tx => tx.txId));
  this.pendingTransactions = this.pendingTransactions.filter(tx => !includedIds.has(tx.txId));
  for (const id of includedIds) this.mempoolTxIds.delete(id);

  // Network-wide tallies: burned base fees and newly mined coins (incl. priority fees).
  this.totalBurned += totalBaseBurn;
  this.totalMined += coinbaseAmount;

  // Operational log for traceability.
  console.log('DBG chosenTxs:', chosenTxs.length);
  console.log('DBG latest hash:', this.getLatestBlock().hash);

  console.log(
    `Mined block with ${blockTxs.length} txs: baseFee burned=${totalBaseBurn}, ` +
    `priorityReward=${totalPriorityFees}, coinbase=${coinbaseAmount}, merkleRoot=${block.merkleRoot}`
  );
}



  
  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const tx of block.transactions || []) {
        if (tx.fromAddress === address) {
          //sender pays full amount (including fees)
          balance -= (tx.amount + tx.baseFee + tx.priorityFee);
        }
        if (tx.toAddress === address) {
          //receiver gets the amount
          balance += tx.amount;
        }
        // coinbase
        if (tx.fromAddress === null && tx.toAddress === address) {
          balance += tx.amount;
        }
      }
    }
    return balance;
  }

  getSpendableBalance(address) {
    const onChain = this.getBalanceOfAddress(address);
    let reserved = 0;
    for (const tx of this.pendingTransactions) {
      if (tx.fromAddress === address) reserved += tx.totalCost();
    }
    return onChain - reserved;
  }

  addTransaction(tx, { allowSelfTransfer = false } = {}) {
    if (!tx || typeof tx !== 'object') {
      throw new Error('Invalid transaction object');
    }
    if (tx.fromAddress === undefined || tx.toAddress === undefined) {
      throw new Error('Transaction must include from and to address');
    }
    if (tx.amount <= 0) {
      throw new Error('Transaction amount should be > 0');
    }
    if (tx.baseFee <= 0 || tx.priorityFee <= 0) {
      throw new Error('Fees must be > 0');
    }
    if (!allowSelfTransfer && tx.isSelfTransfer()) {
      throw new Error('Self-transfers are not allowed');
    }
    if (!tx.isValid()) {
      throw new Error('Cannot add invalid transaction to the chain');
    }
    if (this.mempoolTxIds.has(tx.txId)) {
      throw new Error(`Duplicate transaction (txId ${tx.txId}) already in mempool`);
    }
    if (tx.fromAddress !== null) {
      const spendable = this.getSpendableBalance(tx.fromAddress);
      if (spendable < tx.totalCost()) {
        throw new Error(
          `Insufficient balance for transaction from ${tx.fromAddress}: need ${tx.totalCost()}, have ${spendable}`
        );
      }
    }

    this.pendingTransactions.push(tx);
    this.mempoolTxIds.add(tx.txId);
  }
}

        

//***************************************************** */
// Exporting the Blockchain class and Block and transactions classes for use in other files
// This allows other files to import and use the Blockchain functionality
module.exports = Blockchain;
module.exports.Block = Block;
module.exports.transactions = transactions;
