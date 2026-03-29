
const express = require('express');
const router = express.Router();
const axios = require('axios');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// 🔥 Wallets (Admin deposit wallet)
const TRC20_ADDRESS = process.env.USDT_TRC20_ADDRESS;
const BEP20_ADDRESS = process.env.USDT_BEP20_ADDRESS;
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const USDT_CONTRACT = process.env.USDT_BEP20_CONTRACT;

const USDT_TO_INR = Number(process.env.USDT_TO_INR) || 80;

// ═══════════════════════════════════════════════
// 🔥 ADD / UPDATE USER WALLET
// ═══════════════════════════════════════════════
router.post('/add-wallet', auth, async (req, res) => {
  try {
    const { address, network } = req.body;

    if (!address || !network) {
      return res.json({ success: false, message: 'Address & network required' });
    }

    const user = await User.findById(req.user._id);

    // Basic validation
    if (network === 'TRC20') {
      if (!address.startsWith('T')) {
        return res.json({ success: false, message: 'Invalid TRC20 address' });
      }
      user.cryptoWallets.trc20 = address;
    }

    if (network === 'BEP20') {
      if (!address.startsWith('0x')) {
        return res.json({ success: false, message: 'Invalid BEP20 address' });
      }
      user.cryptoWallets.bep20 = address;
    }

    await user.save();

    res.json({
      success: true,
      message: `${network} wallet saved`,
      wallets: user.cryptoWallets
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════
// 📥 GET USER WALLETS
// ═══════════════════════════════════════════════
router.get('/my-wallets', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      wallets: user.cryptoWallets
    });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════
// ❌ REMOVE WALLET
// ═══════════════════════════════════════════════
router.post('/remove-wallet', auth, async (req, res) => {
  try {
    const { network } = req.body;

    const user = await User.findById(req.user._id);

    if (network === 'TRC20') user.cryptoWallets.trc20 = '';
    if (network === 'BEP20') user.cryptoWallets.bep20 = '';

    await user.save();

    res.json({
      success: true,
      message: `${network} wallet removed`
    });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════
// 🔥 GET DEPOSIT ADDRESSES (ADMIN)
// ═══════════════════════════════════════════════
router.get('/usdt-address', (req, res) => {
  res.json({
    success: true,
    addresses: {
      TRC20: TRC20_ADDRESS,
      BEP20: BEP20_ADDRESS,
    }
  });
});

// ═══════════════════════════════════════════════
// 🔍 VERIFY TRC20
// ═══════════════════════════════════════════════



const verifyTRC20 = async (txHash) => {
  try {
    const res = await axios.get(
      `https://apilist.tronscan.org/api/transaction-info?hash=${txHash}`
    );

    const tx = res.data;

    if (!tx || tx.contractRet !== 'SUCCESS') {
      return { success: false };
    }

    // 🔥 TRC20 transfers array
    const transfers = tx.trc20TransferInfo;

    if (!transfers || transfers.length === 0) {
      return { success: false };
    }

    // 👉 find correct USDT transfer
    const transfer = transfers.find(
      (t) =>
        t.to_address.toLowerCase() === TRC20_ADDRESS.toLowerCase() &&
        t.tokenId === TRC20_ADDRESS
    );

    if (!transfer) {
      return { success: false };
    }

    return {
      success: true,
      amount: Number(transfer.amount_str) / 1e6,
      to: transfer.to_address,
      from: transfer.from_address,
    };

  } catch (err) {
    console.log("TRC20 ERROR:", err.message);
    return { success: false };
  }
};

// ═══════════════════════════════════════════════
// 🔍 VERIFY BEP20 (basic)
// ═══════════════════════════════════════════════


// const verifyBEP20 = async (txHash) => {
//   try {
//     const res = await axios.get(
//       `https://api.bscscan.com/api?module=account&action=tokentx&txhash=${txHash}&apikey=${BSCSCAN_API_KEY}`
//     );

//     const txs = res.data.result;

//     if (!txs || txs.length === 0) {
//       return { success: false };
//     }

//     const tx = txs.find(
//       (t) =>
//         t.to.toLowerCase() === BEP20_ADDRESS.toLowerCase() &&
//         t.contractAddress.toLowerCase() === BEP20_ADDRESS.toLowerCase()
//     );

//     if (!tx) return { success: false };

//     return {
//       success: true,
//       amount: Number(tx.value) / 1e18,
//       to: tx.to,
//       from: tx.from,
//     };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };



// const verifyBEP20 = async (txHash) => {
//   try {
//     const res = await axios.get(
//       `https://api.bscscan.com/api?module=account&action=tokentx&txhash=${txHash}&apikey=${BSCSCAN_API_KEY}`
//     );

//     const txs = res.data.result;

//     if (!txs || txs.length === 0) {
//       return { success: false };
//     }

//     const tx = txs.find(
//       (t) =>
//         t.to.toLowerCase() === BEP20_ADDRESS.toLowerCase() &&
//         t.contractAddress.toLowerCase() === USDT_CONTRACT.toLowerCase()
//     );

//     if (!tx) return { success: false };

//     return {
//       success: true,
//       amount: Number(tx.value) / 1e18,
//       to: tx.to,
//       from: tx.from,
//     };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };



// const verifyBEP20 = async (txHash) => {
//   try {
//     const res = await axios.get(
//       `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${BSCSCAN_API_KEY}`
//     );

//     const receipt = res.data.result;

//     if (!receipt) return { success: false };

//     // ✅ check status
//     if (receipt.status !== "0x1") {
//       return { success: false };
//     }

//     // 🔥 LOGS = token transfer details
//     const logs = receipt.logs;

//     if (!logs || logs.length === 0) {
//       return { success: false };
//     }

//     // 👉 find USDT transfer
//     const log = logs.find(
//       (l) =>
//         l.address.toLowerCase() === USDT_CONTRACT.toLowerCase()
//     );

//     if (!log) return { success: false };

//     // 🔥 decode amount (data field hex → number)
//     const amount = parseInt(log.data, 16) / 1e18;

//     // 🔥 decode receiver address
//     const to = "0x" + log.topics[2].slice(26);

//     return {
//       success: true,
//       amount,
//       to,
//       from: "unknown"
//     };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };



// const verifyBEP20 = async (txHash) => {
//   try {

//      console.log("TX HASH:", txHash); // ✅ yaha

//     const res = await axios.get(
//       `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${BSCSCAN_API_KEY}`
//     );

   

//     const receipt = res.data.result;

//     console.log("RECEIPT:", receipt); 

//     // ❌ no tx
//     if (!receipt) {
//       console.log("No receipt");
//       return { success: false };
//     }

//     // ❌ failed tx
//     if (receipt.status !== "0x1") {
//       console.log("Tx failed");
//       return { success: false };
//     }

//     const logs = receipt.logs;

//     console.log("LOGS:", logs);

//     if (!logs || logs.length === 0) {
//       console.log("No logs");
//       return { success: false };
//     }

//     // ✅ find USDT transfer log
//     const log = logs.find(
//       (l) =>
//         l.address.toLowerCase() === USDT_CONTRACT.toLowerCase()
//     );

//     if (!log) {
//       console.log("No USDT log found");
//       return { success: false };
//     }

//     // 🔥 decode receiver address
//     const to = "0x" + log.topics[2].slice(26);

//     // 🔥 decode amount
//     const amount = parseInt(log.data, 16) / 1e18;

//     console.log("DETECTED:", { to, amount });

//     return {
//       success: true,
//       amount,
//       to,
//       from: "unknown"
//     };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };




// const verifyBEP20 = async (txHash) => {
//   try {

//      console.log("TX HASH:", txHash); // ✅ yaha
//     // 1️⃣ Get transaction receipt
//     const receiptRes = await axios.get(
//       `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${BSCSCAN_API_KEY}`
//     );

//     const receipt = receiptRes.data.result;

//     if (!receipt || !receipt.logs) {
//       console.log("No receipt/logs");
//       return { success: false };
//     }

//     // 2️⃣ Decode logs
//     const logs = receipt.logs;

//     // USDT transfer topic (Transfer event)
//     const transferTopic =
//       "0xddf252ad00000000000000000000000000000000000000000000000000000000";

//     const log = logs.find(
//       (l) =>
//         l.address.toLowerCase() === USDT_CONTRACT.toLowerCase() &&
//         l.topics[0] === transferTopic
//     );

//     if (!log) {
//       console.log("No USDT transfer log");
//       return { success: false };
//     }

//     // 3️⃣ Extract addresses
//     const to =
//       "0x" + log.topics[2].slice(26); // receiver
//     const from =
//       "0x" + log.topics[1].slice(26); // sender

//     // 4️⃣ Extract amount
//     const amount = parseInt(log.data, 16) / 1e18;

//     console.log("TO:", to);
//     console.log("EXPECTED:", BEP20_ADDRESS);

//     // 5️⃣ Match address
//     if (to.toLowerCase() !== BEP20_ADDRESS.toLowerCase()) {
//       return { success: false };
//     }

//     return {
//       success: true,
//       amount,
//       to,
//       from,
//     };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };





// const verifyBEP20 = async (txHash) => {
//   try {
//     const res = await axios.get(
//       `https://api.bscscan.com/api?module=account&action=tokentx&address=${BEP20_ADDRESS}&apikey=${BSCSCAN_API_KEY}`
//     );

//     const txs = res.data.result;

//     if (!txs || txs.length === 0) {
//       return { success: false };
//     }

//     // 🔥 match by txHash
//     const tx = txs.find(
//       (t) =>
//         t.hash.toLowerCase() === txHash.toLowerCase() &&
//         t.contractAddress.toLowerCase() === USDT_CONTRACT.toLowerCase()
//     );

//     if (!tx) {
//       console.log("TX NOT FOUND IN LIST");
//       return { success: false };
//     }

//     return {
//       success: true,
//       amount: Number(tx.value) / 1e18,
//       to: tx.to,
//       from: tx.from,
//     };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };






// const verifyBEP20 = async (txHash) => {
//   try {
//     console.log("TX HASH:", txHash);

//     const res = await axios.get(
//       `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${BSCSCAN_API_KEY}`
//     );

//     const receipt = res.data.result;

//     if (!receipt) {
//       console.log("No receipt");
//       return { success: false };
//     }

//     const logs = receipt.logs;

//     if (!logs || logs.length === 0) {
//       console.log("No logs");
//       return { success: false };
//     }

//     console.log("LOGS:", logs);

//     // 👉 USDT Transfer event signature
//     const TRANSFER_TOPIC =
//       "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aeb";

//     for (let log of logs) {
//       if (
//         log.topics[0].toLowerCase().startsWith(TRANSFER_TOPIC) &&
//         log.address.toLowerCase() === USDT_CONTRACT.toLowerCase()
//       ) {
//         const to = "0x" + log.topics[2].slice(26);

//         if (to.toLowerCase() !== BEP20_ADDRESS.toLowerCase()) continue;

//         const amount = parseInt(log.data, 16) / 1e18;

//         return {
//           success: true,
//           amount,
//           to,
//           from: "decoded",
//         };
//       }
//     }

//     return { success: false };

//   } catch (err) {
//     console.log("BEP20 ERROR:", err.message);
//     return { success: false };
//   }
// };




const verifyBEP20 = async (txHash) => {
  try {
    console.log("TX HASH:", txHash);

    const res = await axios.get(
      `https://api.bscscan.com/api?module=account&action=tokentx&address=${BEP20_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BSCSCAN_API_KEY}`
    );

    const txs = res.data.result;

    if (!txs || txs.length === 0) {
      console.log("No transactions found");
      return { success: false };
    }

    console.log("TOTAL TXS:", txs.length);

    // 👉 find matching txHash
    const tx = txs.find(
      (t) =>
        t.hash.toLowerCase() === txHash.toLowerCase() &&
        t.contractAddress.toLowerCase() === USDT_CONTRACT.toLowerCase()
    );

    if (!tx) {
      console.log("TX NOT FOUND IN LIST");
      return { success: false };
    }

    console.log("MATCHED TX:", tx);

    return {
      success: true,
      amount: Number(tx.value) / 1e18,
      to: tx.to,
      from: tx.from,
    };

  } catch (err) {
    console.log("BEP20 ERROR:", err.message);
    return { success: false };
  }
};





// ═══════════════════════════════════════════════
// 💰 VERIFY + DEPOSIT
// ═══════════════════════════════════════════════
router.post('/verify-usdt', auth, async (req, res) => {

console.log("🔥 VERIFY API HIT"); // ✅ ye add karo

  try {
    const { txHash, network } = req.body;

    console.log("BODY:", req.body); 

    if (!txHash || !network) {
      return res.json({ success: false, message: 'txHash & network required' });
    }

    const exists = await Transaction.findOne({ txHash });
    if (exists) {
      return res.json({ success: false, message: 'Already used txHash' });
    }

    let verify;
    let walletAddress;

    if (network === 'TRC20') {
      verify = await verifyTRC20(txHash);
      walletAddress = TRC20_ADDRESS;
    } else {
      verify = await verifyBEP20(txHash);
      walletAddress = BEP20_ADDRESS;
    }

    if (!verify.success) {
      return res.json({ success: false, message: 'Invalid transaction' });
    }

    if (verify.to.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.json({ success: false, message: 'Wrong wallet address' });
    }

    if (verify.amount <= 0) {
      return res.json({ success: false, message: 'Invalid amount' });
    }

    const user = await User.findById(req.user._id);

    const amountINR = verify.amount * USDT_TO_INR;

    const before = user.wallet.realBalance;
    user.wallet.realBalance += amountINR * 100;

    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'deposit',
      amount: amountINR * 100,
      status: 'completed',
      txHash,
      network,
      balanceBefore: before,
      balanceAfter: user.wallet.realBalance,
    });

    res.json({
      success: true,
      message: 'Deposit successful',
      newBalance: user.wallet.realBalance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════
// 💸 WITHDRAW (USE SAVED WALLET)
// ═══════════════════════════════════════════════
router.post('/withdraw-usdt', auth, async (req, res) => {
  try {
    const { amount, network } = req.body;

    if (!amount || amount < 100) {
      return res.json({ success: false, message: 'Minimum ₹100 required' });
    }

    const user = await User.findById(req.user._id);

    const walletAddress =
      network === 'TRC20'
        ? user.cryptoWallets.trc20
        : user.cryptoWallets.bep20;

    if (!walletAddress) {
      return res.json({
        success: false,
        message: `Add ${network} wallet first`
      });
    }

    if (user.wallet.realBalance < amount * 100) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }

    const before = user.wallet.realBalance;
    user.wallet.realBalance -= amount * 100;

    await user.save();

    await Transaction.create({
      userId: user._id,
      type: 'withdrawal',
      amount: amount * 100,
      status: 'pending',
      withdrawAddress: walletAddress,
      network,
      balanceBefore: before,
      balanceAfter: user.wallet.realBalance,
    });

    res.json({
      success: true,
      message: 'Withdraw request submitted'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
