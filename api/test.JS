// api/test.js
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.status(200).json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: {
      hasSenderKey: !!process.env.SENDER_SECRET_KEY,
      hasRpcUrl: !!process.env.SOLANA_RPC_URL,
      hasMintAddress: !!process.env.TOKEN_MINT_ADDRESS
    }
  });
};