const express = require('express');
const axios = require('axios');
const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, Transaction, SystemProgram, Keypair, TokenInstructions } = require('@solana/web3.js');
const { Token } = require('@solana/spl-token');

const app = express();
const port = 3000;

app.use(express.json());  // Enable JSON body parsing

let solPrice = null;
let monkeysPrice = null;
const secretKey = process.env.SOLANA_SECRET_KEY.split(',').map(num => parseInt(num, 10));
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
const senderKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
const MONKEYS_MINT_ADDRESS = new PublicKey('BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC'); // Your token's mint address

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

async function fetchMonkeysPrice() {
    const apiUrl = 'https://price.jup.ag/v4/price?ids=BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC';
    try {
        const response = await axios.get(apiUrl);
        monkeysPrice = response.data.data.BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC.price;
        console.log(`Updated MONKEYS Price: ${monkeysPrice}`);
    } catch (error) {
        console.error('Failed to fetch MONKEYS price:', error.message);
        monkeysPrice = null;
    }
}

async function sendMonkeys(toAddress, amount) {
    console.log(`Attempting to send ${amount} MONKEYS to ${toAddress}`);

    // Validate the recipient address
    if (!PublicKey.isOnCurve(toAddress)) {
        console.error('Transaction failed: Invalid address');
        return { success: false, message: 'Invalid address' };
    }

    // Convert the amount to the smallest unit
    const decimals = 9; // Adjust based on your token's decimals
    const amountInSmallestUnit = Math.round(amount * Math.pow(10, decimals));

    const recipientPublicKey = new PublicKey(toAddress);
    const senderPublicKey = senderKeypair.publicKey;
    const senderTokenAccount = await Token.getAssociatedTokenAddress(
        TokenInstructions.ASSOCIATED_TOKEN_PROGRAM_ID,
        TokenInstructions.TOKEN_PROGRAM_ID,
        MONKEYS_MINT_ADDRESS,
        senderPublicKey
    );
    const recipientTokenAccount = await Token.getAssociatedTokenAddress(
        TokenInstructions.ASSOCIATED_TOKEN_PROGRAM_ID,
        TokenInstructions.TOKEN_PROGRAM_ID,
        MONKEYS_MINT_ADDRESS,
        recipientPublicKey
    );

    const transaction = new Transaction().add(
        Token.createTransferInstruction(
            TokenInstructions.TOKEN_PROGRAM_ID,
            senderTokenAccount,
            recipientTokenAccount,
            senderPublicKey,
            [],
            amountInSmallestUnit
        )
    );

    try {
        const signature = await connection.sendTransaction(transaction, [senderKeypair], { skipPreflight: false });
        console.log(`Transaction signature: ${signature}`);
        await connection.confirmTransaction(signature);
        console.log(`Successfully sent ${amount} MONKEYS to ${toAddress}`);
        return { success: true, message: 'Transaction successful' };
    } catch (error) {
        console.error('Transaction failed:', error);
        return { success: false, message: error.message };
    }
}

app.get('/amountMONKEYS/:usdt', (req, res) => {
    const usdt = parseFloat(req.params.usdt);
    if (isNaN(usdt) || usdt < 0) {
        return res.status(400).json({ success: false, message: 'Invalid dollar amount' });
    }
    if (monkeysPrice === null) {
        return res.status(503).json({ success: false, message: 'MONKEYS price not available. Try again later.' });
    }
    const monkeysAmount = usdt / monkeysPrice;
    res.json({ success: true, monkeys: monkeysAmount });
});

app.post('/payMONKEYS', async (req, res) => {
    const { usdt, address } = req.body;
    if (!address) {
        return res.status(400).json({ success: false, message: 'Missing address' });
    }

    const amountMONKEYS = parseFloat(usdt);
    if (isNaN(amountMONKEYS) || amountMONKEYS < 0) {
        return res.status(400).json({ success: false, message: 'Invalid MONKEYS amount' });
    }

    if (monkeysPrice === null) {
        return res.status(503).json({ success: false, message: 'MONKEYS price not available. Try again later.' });
    }

    const monkeysAmount = amountMONKEYS / monkeysPrice;
    const transactionSuccess = await sendMonkeys(address, monkeysAmount);

    if (transactionSuccess) {
        const discountAmount = monkeysAmount * 0.20;  // 20% discount
        console.log(`Refunding 20% (${discountAmount} MONKEYS) back to sender`);
        res.json({ success: true, message: 'Transaction successful', discountAmount: discountAmount });
    } else {
        res.status(500).json({ success: false, message: 'Transaction failed' });
    }
});

fetchSolPrice();
fetchMonkeysPrice();
setInterval(fetchSolPrice, 30000);  // fetching every 30 seconds
setInterval(fetchMonkeysPrice, 30000);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
