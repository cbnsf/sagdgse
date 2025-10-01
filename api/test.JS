import { Connection, PublicKey } from '@solana/web3.js';

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('Test endpoint called - ES Module');
  
  try {
    // 测试 Solana 连接
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const version = await connection.getVersion();
    
    res.status(200).json({ 
      success: true, 
      message: 'API is working with ES Modules!',
      timestamp: new Date().toISOString(),
      solana: {
        connected: true,
        version: version['solana-core']
      },
      environment: {
        hasSenderKey: !!process.env.SENDER_SECRET_KEY,
        hasRpcUrl: !!process.env.SOLANA_RPC_URL,
        hasMintAddress: !!process.env.TOKEN_MINT_ADDRESS
      }
    });
  } catch (error) {
    res.status(200).json({ 
      success: true, 
      message: 'API is working with ES Modules! (Solana connection failed)',
      timestamp: new Date().toISOString(),
      error: error.message,
      environment: {
        hasSenderKey: !!process.env.SENDER_SECRET_KEY,
        hasRpcUrl: !!process.env.SOLANA_RPC_URL,
        hasMintAddress: !!process.env.TOKEN_MINT_ADDRESS
      }
    });
  }
}
