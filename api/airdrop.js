import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  getMint,
  transferChecked,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

function loadSenderKeypairFromEnv() {
  const raw = process.env.SENDER_SECRET_KEY;
  if (!raw) throw new Error('SENDER_SECRET_KEY env missing');

  // 如果是 JSON 数组字符串 -> 解析为 Uint8Array
  if (raw.trim().startsWith('[')) {
    const arr = JSON.parse(raw);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }

  // 其他情况视为 base58 编码的私钥
  try {
    const secret = bs58.decode(raw.trim());
    return Keypair.fromSecretKey(secret);
  } catch (e) {
    throw new Error('Invalid SENDER_SECRET_KEY format. Use base58 or JSON array.');
  }
}

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Only POST supported' });
  }

  try {
    const { walletAddress } = req.body || {};
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'walletAddress missing' });
    }

    // ENV 必要项
    const RPC_URL = process.env.SOLANA_RPC_URL;
    const MINT_ADDR = process.env.TOKEN_MINT_ADDRESS;
    const AIRDROP_AMOUNT = process.env.AIRDROP_AMOUNT || '25000';

    if (!RPC_URL || !MINT_ADDR) {
      return res.status(500).json({ 
        success: false, 
        error: 'SOLANA_RPC_URL and TOKEN_MINT_ADDRESS must be set in env' 
      });
    }

    // 如果没有私钥配置，返回测试模式
    if (!process.env.SENDER_SECRET_KEY) {
      return res.status(200).json({
        success: true,
        message: 'Airdrop API is working! (Test mode - set SENDER_SECRET_KEY for real airdrop)',
        walletAddress: walletAddress,
        mode: 'test'
      });
    }

    // 建立连接
    const connection = new Connection(RPC_URL, 'confirmed');

    // 读取发送者密钥对
    const senderKeypair = loadSenderKeypairFromEnv();

    // 公钥对象
    const mintPubkey = new PublicKey(MINT_ADDR);
    const recipientPubkey = new PublicKey(walletAddress);

    // 读取 mint 信息，获取 decimals
    const mintInfo = await getMint(connection, mintPubkey);
    const decimals = mintInfo.decimals;

    // 计算最小单位数量（BigInt）
    const amountToken = BigInt(AIRDROP_AMOUNT);
    const amountToSend = amountToken * (BigInt(10) ** BigInt(decimals));

    // 获取或创建发送方的 ATA（作为源）
    const senderPubkey = senderKeypair.publicKey;
    const senderAta = await getOrCreateAssociatedTokenAccount(
      connection, 
      senderKeypair, 
      mintPubkey, 
      senderPubkey
    );

    // 检查发送方余额
    const senderAccount = await getAccount(connection, senderAta.address);
    if (senderAccount.amount < amountToSend) {
      return res.status(400).json({ 
        success: false, 
        error: 'insufficient_token_balance' 
      });
    }

    // 获取或创建接收方的 ATA
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection, 
      senderKeypair, 
      mintPubkey, 
      recipientPubkey
    );

    // 执行 transferChecked
    const signature = await transferChecked(
      connection,
      senderKeypair,
      senderAta.address,
      mintPubkey,
      recipientAta.address,
      senderPubkey,
      amountToSend,
      decimals
    );

    return res.status(200).json({ 
      success: true, 
      signature,
      message: `${AIRDROP_AMOUNT} DUCK tokens sent successfully!`
    });

  } catch (err) {
    console.error('Airdrop error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message || String(err) 
    });
  }
}
