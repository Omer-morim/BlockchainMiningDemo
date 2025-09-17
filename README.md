# Blockchain Demo

This project is a simplified blockchain implementation in Node.js and Express, designed to demonstrate fundamental blockchain concepts.  
It was developed as part of an academic project in the Computer Science degree at HIT.

---

## Features
- Transaction management with **EIP-1559 style fees** (base fee burn + priority fee to miners)  
- Block mining with **Proof-of-Work**  
- **Merkle tree root** per block for transaction verification  
- **Full node vs. light wallet** architecture  
- **Bloom filters** for efficient address/transaction lookup  
- **Coinbase transactions** for block rewards  

---

## Technologies Used
- Node.js  
- Express.js  
- crypto-js (SHA256)  
- elliptic (secp256k1 keys & signatures)  
- JavaScript  

---

## Project Structure

blockchain-demo/
├── blockChain.js # Core blockchain logic (transactions, blocks, chain)
├── bloom.js # Bloom filter implementation
├── config.js # Configuration constants (fees, difficulty, rewards)
├── fullnode.js # Full node with mining, mempool, bloom
├── lightwallet.js # Light wallet with headers + Bloom + Merkle proofs
├── main.js # Demo entry point
├── package.json


---

## Getting Started

Clone the repository:
```bash
git clone https://github.com/omer-morim/blockchain-demo.git
cd blockchain-demo

Install dependencies:
npm install

Run the application:
node main.js




