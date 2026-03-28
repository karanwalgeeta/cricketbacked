
// const express = require('express');
// const router = express.Router();
// const axios = require('axios');

// const User = require('../models/User');
// const Transaction = require('../models/Transaction');
// const auth = require('../middleware/auth');

// const USDT_WALLET_ADDRESS = process.env.USDT_WALLET_ADDRESS;
// const USDT_TO_INR = Number(process.env.USDT_TO_INR) || 80;


// // 🔥 FIXED RATE (later dynamic kar sakta hai)
// // const USDT_TO_INR = 80;

// // ═══════════════════════════════════════════════
// // 🔥 GET USDT ADDRESS (Frontend use karega)
// // ═══════════════════════════════════════════════
// router.get('/usdt-address', (req, res) => {
//   res.json({
//     success: true,
//     address: USDT_WALLET_ADDRESS
//   });
// });



// // ═══════════════════════════════════════════════
// // 🔍 VERIFY USDT (TRON API)
// // ═══════════════════════════════════════════════
// const verifyUSDT = async (txHash) => {
//   try {
//     const res = await axios.get(
//       `https://apilist.tronscan.org/api/transaction-info?hash=${txHash}`
//     );

//     const tx = res.data;

//     if (!tx || tx.contractRet !== 'SUCCESS') {
//       return { success: false };
//     }

//     return {
//       success: true,
//       amount: tx.contractData.amount / 1e6,
//       to: tx.contractData.to_address,
//       from: tx.ownerAddress,
//     };

//   } catch (err) {
//     console.error("Verify Error:", err);
//     return { success: false };
//   }
// };



// // ═══════════════════════════════════════════════
// // 💰 VERIFY + DEPOSIT (MAIN API)
// // ═══════════════════════════════════════════════
// router.post('/verify-usdt', auth, async (req, res) => {
//   try {
//     const { txHash } = req.body;

//     if (!txHash) {
//       return res.json({ success: false, message: 'txHash required' });
//     }

//     // 🔒 DUPLICATE CHECK
//     const exists = await Transaction.findOne({ txHash });
//     if (exists) {
//       return res.json({ success: false, message: 'Already used txHash' });
//     }

//     const verify = await verifyUSDT(txHash);

//     if (!verify.success) {
//       return res.json({ success: false, message: 'Invalid or pending transaction' });
//     }

//     // 🔒 ADDRESS CHECK
//     if (verify.to !== USDT_WALLET_ADDRESS) {
//       return res.json({ success: false, message: 'Wrong wallet address' });
//     }

//     // 🔒 MINIMUM AMOUNT CHECK
//     if (verify.amount <= 0) {
//       return res.json({ success: false, message: 'Invalid amount' });
//     }

//     const user = await User.findById(req.user._id);

//     const amountUSDT = verify.amount;
//     const amountINR = amountUSDT * USDT_TO_INR;

//     const before = user.wallet.realBalance;
//     user.wallet.realBalance += amountINR * 100;

//     await user.save();

//     // 🔥 SAVE TRANSACTION
//     await Transaction.create({
//       userId: user._id,
//       type: 'deposit',
//       amount: amountINR * 100,
//       currency: 'INR',
//       status: 'completed',
//       txHash,
//       fromAddress: verify.from,
//       toAddress: verify.to,
//       network: 'TRC20',
//       description: `USDT Deposit (${amountUSDT} USDT)`,
//       balanceBefore: before,
//       balanceAfter: user.wallet.realBalance,
//     });

//     res.json({
//       success: true,
//       message: `Deposit successful (${amountUSDT} USDT)`,
//       newBalance: user.wallet.realBalance,
//     });

//   } catch (err) {
//     console.error("Deposit Error:", err);
//     res.status(500).json({ success: false });
//   }
// });



// // ═══════════════════════════════════════════════
// // 💸 WITHDRAW USDT (REQUEST)
// // ═══════════════════════════════════════════════
// router.post('/withdraw-usdt', auth, async (req, res) => {
//   try {
//     const { amount, address } = req.body;

//     if (!amount || amount < 100) {
//       return res.json({ success: false, message: 'Minimum ₹100 required' });
//     }

//     if (!address || address.length < 20) {
//       return res.json({ success: false, message: 'Invalid USDT address' });
//     }

//     const user = await User.findById(req.user._id);

//     if (user.wallet.realBalance < amount * 100) {
//       return res.json({ success: false, message: 'Insufficient balance' });
//     }

//     const before = user.wallet.realBalance;
//     user.wallet.realBalance -= amount * 100;

//     await user.save();

//     await Transaction.create({
//       userId: user._id,
//       type: 'withdrawal',
//       amount: amount * 100,
//       currency: 'INR',
//       status: 'pending',
//       withdrawAddress: address,
//       network: 'TRC20',
//       description: `USDT Withdrawal (${amount})`,
//       balanceBefore: before,
//       balanceAfter: user.wallet.realBalance,
//     });

//     res.json({
//       success: true,
//       message: 'Withdrawal request submitted',
//     });

//   } catch (err) {
//     console.error("Withdraw Error:", err);
//     res.status(500).json({ success: false });
//   }
// });



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



// // ═══════════════════════════════════════════════
// // 🔥 ADMIN: ALL PAYMENTS
// // ═══════════════════════════════════════════════
// router.get('/admin/all-payments', async (req, res) => {
//   try {
//     const payments = await Transaction.find({ type: 'deposit' })
//       .populate('userId', 'name email')
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       payments,
//     });

//   } catch (err) {
//     res.status(500).json({ success: false });
//   }
// });









const express = require('express');
const router = express.Router();
const axios = require('axios');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// 🔥 Wallets (Admin deposit wallet)
const TRC20_ADDRESS = process.env.USDT_TRC20_ADDRESS;
const BEP20_ADDRESS = process.env.USDT_BEP20_ADDRESS;

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

    return {
      success: true,
      amount: tx.contractData.amount / 1e6,
      to: tx.contractData.to_address,
      from: tx.ownerAddress,
    };

  } catch {
    return { success: false };
  }
};

// ═══════════════════════════════════════════════
// 🔍 VERIFY BEP20 (basic)
// ═══════════════════════════════════════════════
const verifyBEP20 = async (txHash) => {
  try {
    const res = await axios.get(
      `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=YourApiKey`
    );

    if (res.data.status !== "1") {
      return { success: false };
    }

    return {
      success: true,
      amount: 0,
      to: BEP20_ADDRESS,
      from: "unknown"
    };

  } catch {
    return { success: false };
  }
};

// ═══════════════════════════════════════════════
// 💰 VERIFY + DEPOSIT
// ═══════════════════════════════════════════════
router.post('/verify-usdt', auth, async (req, res) => {
  try {
    const { txHash, network } = req.body;

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



// module.exports = router;
