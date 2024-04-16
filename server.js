const express = require('express');
const { ethers } = require('ethers');
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const JSBI = require('jsbi');
const { TickMath, FullMath } = require('@uniswap/v3-sdk');

const app = express();
const port = 3000;

app.use(express.json());

// Pre-configured providers/connections
const ethProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
const solanaConnection = new Connection(clusterApiUrl('mainnet-beta'));
const bscProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

// Verify token address API
app.post('/verify-token', async (req, res) => {
    const { chain, tokenAddress } = req.body;

    try {
        switch (chain) {
            case 'eth':
            case 'bsc':
                const provider = chain === 'eth' ? ethProvider : bscProvider;
                const tokenContract = new ethers.Contract(tokenAddress, ['function balanceOf(address) view returns (uint)'], provider);
                try {
                    await tokenContract.balanceOf('0x0000000000000000000000000000000000000000');
                    res.json({ valid: true });
                } catch (error) {
                    res.json({ valid: false, reason: "No contract at this address or contract does not comply with expected interface." });
                }
                break;
            case 'sol':
                if (PublicKey.isOnCurve(tokenAddress)) {
                    try {
                        const accountInfo = await solanaConnection.getAccountInfo(new PublicKey(tokenAddress));
                        const isValid = accountInfo && accountInfo.owner.toString() === 'TokenkegQfeZxi3kCk6qPLiM6DHu3UcbwRqrWfzX8exF';
                        res.json({ valid: isValid });
                    } catch (error) {
                        res.json({ valid: false, reason: "Failed to fetch account info." });
                    }
                } else {
                    res.json({ valid: false, reason: "Invalid Solana address format." });
                }
                break;
            default:
                res.status(400).json({ error: 'Invalid blockchain selected' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Existing code for blockchain network selection
app.post('/select-chain', async (req, res) => {
    const { chain } = req.body;

    try {
        switch (chain) {
            case 'eth':
                const ethChainId = await ethProvider.getNetwork().then(network => network.chainId);
                console.log("Ethereum network : ",ethChainId);
                res.json({ chainId: ethChainId });
                break;
            case 'sol':
                const solChainId = solanaConnection._rpcEndpoint;
                console.log("Solana network : ",solChainId);
                res.json({ chainId: solChainId });
                break;
            case 'bsc':
                const bscChainId = await bscProvider.getNetwork().then(network => network.chainId);
                console.log("Binance Smart Chain network : ",bscChainId);
                res.json({ chainId: bscChainId });
                break;
            default:
                res.status(400).json({ error: 'Invalid blockchain selected' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Endpoint to fetch SOL price
app.get('/price/sol', async (req, res) => {
    try {
        // URL of the external API
        const apiUrl = 'https://price.jup.ag/v4/price?ids=SOL';
        
        // Fetching data from external API
        const response = await axios.get(apiUrl);
        
        // Sending the response back to the client
        res.json({
            success: true,
            price: response.data.data.SOL.price
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch price',
            error: error.message
        });
    }
});

//Endpoint to fetch MONKEYS price
app.get('/price/MONKEYS', async (req, res) => {
    try {
        const apiUrl = 'https://price.jup.ag/v4/price?ids=BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC';
        const response = await axios.get(apiUrl);
        const price = response.data.data.BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC.price;
        res.json({ price });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

//Endpoint to fetch ETH price
app.post("/price/ETH", async (req, res) => {
    try {
      // Get the square root ratio at the specified tick
      const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(-196021);
      // Calculate the ratio by squaring the square root ratio
      const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96);
      // Convert input amount to base token amount (in wei)
      const baseAmount = JSBI.BigInt(1 * (10 ** 18));
      // Shift to the left by 192 bits (equivalent to multiplying by 2^192)
      const shift = JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(192));
      // Calculate quote amount in terms of quote token (TNM)
      const quoteAmount = FullMath.mulDivRoundingUp(ratioX192, baseAmount, shift);
      // Convert quote amount from wei to the original unit
      const calculatedQuoteAmount = parseFloat(quoteAmount.toString()) / (10 ** 6);
      res.json({ quoteAmount: calculatedQuoteAmount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
