const express = require('express');
const { Connection, PublicKey } = require('@solana/web3.js');
const WebSocket = require('ws');
const app = express();
const port = 3000;
const clusterUrl = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(clusterUrl, 'confirmed');
let previousBalances = {};

app.get('/balance/:address', async (req, res) => {
    const { address } = req.params;
    try {
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        // Check if the balance has changed
        if (previousBalances[address] && previousBalances[address] !== balance) {
            const transactionHistory = await connection.getConfirmedSignaturesForAddress2(
                publicKey,
                { limit: 10 }
            );
            const lastDepositTransaction = transactionHistory.find(tx => tx.memo.includes("Deposit"));
            res.json({
                message: "Balance changed",
                newBalance: balance,
                lastDepositTransaction
            });
        } else {
            res.json({ balance });
        }
        previousBalances[address] = balance;
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

const ws = new WebSocket(clusterUrl);

ws.on('open', function open() {
    ws.send(JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "accountSubscribe",
        "params": [
            "6Nd7JbuwazduUWKAV13bcSwB3DwpRwRVcDhKHuVhSnJA",
            { "encoding": "jsonParsed" }
        ]
    }));
});

ws.on('message', async function incoming(data) {
    try {
        const parsedData = JSON.parse(data);
        if (parsedData.method === 'signatureNotification' && parsedData.params.result.value.memo.includes("Deposit")) {
            // If a new deposit transaction is detected, handle it here
            const publicKey = parsedData.params.result.value.pubkey;
            const balance = await connection.getBalance(new PublicKey(publicKey));
            console.log(`New deposit transaction detected for ${publicKey}. Updated balance: ${balance}`);
        }
    } catch (error) {
        console.error("Error processing incoming message:", error);
    }
});