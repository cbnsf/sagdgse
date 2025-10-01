// api/airdrop.js
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// 环境变量 - 需要在 Vercel 中设置
const PRIVATE_KEY = JSON.parse(process.env.WALLET_PRIVATE_KEY || '[]');
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS;
const RPC_URL = process.env.RPC_URL || ''; // 先用 devnet 测试

// 检查环境变量
if (!PRIVATE_KEY.length || !TOKEN_MINT_ADDRESS) {
  console.error('Missing required environment variables');
}

const connection = new Connection(RPC_URL, 'confirmed');
const wallet = Keypair.fromSecretKey(new Uint8Array(PRIVATE_KEY));
const claimedAddresses = new Set();

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // 验证钱包地址
    let recipient;
    try {
      recipient = new PublicKey(walletAddress);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // 检查是否已领取
    if (claimedAddresses.has(walletAddress)) {
      return res.status(400).json({ error: 'Airdrop already claimed' });
    }

    const mint = new PublicKey(TOKEN_MINT_ADDRESS);
    
    // 获取代币账户地址
    const fromTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(mint, recipient);

    const transaction = new Transaction();

    // 检查接收者是否有代币账户
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toTokenAccountInfo) {
      // 如果没有，创建代币账户
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          toTokenAccount,
          recipient,
          mint
        )
      );
    }

    // 添加转账指令 - 修正金额计算
    const decimals = 9; // 假设代币有 6 位小数
    const transferAmount = 25000 * Math.pow(10, decimals);
    
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        wallet.publicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // 设置区块哈希和费用支付者
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // 签名并发送
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // 等待确认
    await connection.confirmTransaction(signature, 'confirmed');

    // 记录已领取
    claimedAddresses.add(walletAddress);

    return res.status(200).json({
      success: true,
      signature,
      message: '25,000 DUCK tokens sent successfully!'
    });

  } catch (error) {
    console.error('Airdrop error:', error);
    return res.status(500).json({ 
      error: 'Failed to process airdrop',
      details: error.message
    });
  }
}