const express = require('express');
const axios = require('axios');
const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, Transaction, SystemProgram, Keypair } = require('@solana/web3.js');
const cors = require('cors'); 
const app = express();
const port = 3000;
app.use(cors());

const secretKey = process.env.SOLANA_SECRET_KEY.split(',').map(num => parseInt(num, 10));
const connection = new Connection(clusterApiUrl('mainnet-beta'));
const senderKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

let solPrice = null;

async function fetchSolPrice() {
    const apiUrl = 'https://price.jup.ag/v4/price?ids=SOL';
    try {
        const response = await axios.get(apiUrl);
        solPrice = response.data.data.SOL.price;
        console.log(`Updated SOL Price: ${solPrice}`);
    } catch (error) {
        console.error('Failed to fetch SOL price:', error.message);
        solPrice = null;
    }
}

async function sendSol(toAddress, amountSol) {
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: senderKeypair.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports: amountSol * LAMPORTS_PER_SOL
        })
    );

    try {
        const signature = await connection.sendTransaction(transaction, [senderKeypair]);
        await connection.confirmTransaction(signature);
        console.log('Transaction successful with signature:', signature);
        return signature;
    } catch (error) {
        console.error('Transaction failed:', error);
        return null;
    }
}

app.get('/amountSOL/:usd/:toAddress', async (req, res) => {
    const usd = parseFloat(req.params.usd);
    const toAddress = req.params.toAddress;

    if (isNaN(usd) || usd < 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid dollar amount'
        });
    }

    if (!PublicKey.isOnCurve(toAddress)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid recipient address'
        });
    }

    if (solPrice === null) {
        return res.status(503).json({
            success: false,
            message: 'SOL price not available. Try again later.'
        });
    }

    const solAmount = usd / solPrice;
    const transactionSignature = await sendSol(toAddress, solAmount);

    if (transactionSignature) {
        res.json({
            success: true,
            signature: transactionSignature
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Failed to send SOL'
        });
    }
});

fetchSolPrice();
setInterval(fetchSolPrice, 30000); // Adjusted interval to 30 seconds for less frequent updates
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
