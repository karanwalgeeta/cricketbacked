


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




// // ═══════════════════════════════════════════════
// // 📜 USER TRANSACTIONS
// // ═══════════════════════════════════════════════


// router.get('/transactions', auth, async (req, res) => {
//   try {
//     const transactions = await Transaction.find({ userId: req.user._id })
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       transactions,
//     });

//   } catch (err) {
//     res.status(500).json({ success: false });
//   }
// });



router.get('/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      transactions,
      pagination: {
        page,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + transactions.length < total,
      }
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



// paid k liye h 


// const verifyBEP20 = async (txHash) => {
//   try {
//     console.log("TX HASH:", txHash);

//     // ✅ V2 endpoint — chainid=56 is BSC Mainnet
//     const res = await axios.get(
//       `https://api.etherscan.io/v2/api?chainid=56&module=account&action=tokentx&address=${BEP20_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BSCSCAN_API_KEY}`
//     );

//     console.log("FULL RESPONSE:", res.data);

//     if (res.data.status !== "1") {
//       console.log("API ERROR:", res.data.message);
//       return { success: false };
//     }

//     const txs = res.data.result;

//     if (!Array.isArray(txs)) {
//       console.log("NOT ARRAY:", txs);
//       return { success: false };
//     }

//     console.log("TOTAL TXS:", txs.length);

//     const tx = txs.find(
//       (t) =>
//         t.hash.toLowerCase() === txHash.toLowerCase() &&
//         t.contractAddress.toLowerCase() === USDT_CONTRACT.toLowerCase()
//     );

//     if (!tx) {
//       console.log("TX NOT FOUND");
//       return { success: false };
//     }

//     console.log("MATCHED TX:", tx);

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



const { ethers } = require("ethers");

const verifyBEP20 = async (txHash) => {
  try {
    // ✅ Public BSC RPC — no API key needed
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");

    const tx = await provider.getTransaction(txHash);
    console.log("TX:", tx);

    if (!tx) {
      console.log("TX NOT FOUND");
      return { success: false };
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      console.log("TX FAILED");
      return { success: false };
    }

    // USDT contract check
    if (tx.to?.toLowerCase() !== USDT_CONTRACT.toLowerCase()) {
      console.log("NOT USDT CONTRACT");
      return { success: false };
    }

    // Decode transfer(address,uint256)
    if (!tx.data.startsWith("0xa9059cbb")) {
      console.log("NOT A TRANSFER");
      return { success: false };
    }

    const recipient = "0x" + tx.data.slice(34, 74);
    const amount = parseInt("0x" + tx.data.slice(74, 138), 16) / 1e18;

    console.log("RECIPIENT:", recipient);
    console.log("AMOUNT:", amount);

    if (recipient.toLowerCase() !== BEP20_ADDRESS.toLowerCase()) {
      console.log("WRONG RECIPIENT:", recipient);
      return { success: false };
    }

    return { success: true, amount, to: recipient, from: tx.from };

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

    // await Transaction.create({
    //   userId: user._id,
    //   type: 'deposit',
    //   amount: amountINR * 100,
    //   status: 'completed',
    //   txHash,
    //   network,
    //   balanceBefore: before,
    //   balanceAfter: user.wallet.realBalance,
    // });


    await Transaction.create({
  userId: user._id,
  type: 'deposit',
  amount: amountINR * 100,
  currency: 'INR',           // ← add karo
  status: 'completed',
  txHash,
  network,
  usdtAmount: verify.amount,           // ← actual USDT
  usdtToInrRate: USDT_TO_INR,          // ← rate at time of deposit
  fromAddress: verify.from,            // ← sender address
  toAddress: verify.to,                // ← your wallet address
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
