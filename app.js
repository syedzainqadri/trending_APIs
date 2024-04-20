const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const bs58 = require('bs58');
const axios = require('axios');
const http = require('http');
const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors());
const WebSocket = require('ws');
const { stat } = require('fs');
const wsClient = new WebSocket.Server({ port: 8080 });

app.post('/createSOL', async (req, res) => {
    const {
        chain,dex,pairAddress,paymentMethod,orderStatus,requestFrom,slot,price } = req.body;
    const txhash = "ljasbdacviwelufhbkjadhfkajsdhfaosidcberkjfhniudhfkajsdfnaksjdfnb"
    const keyPair = Keypair.generate();
    const publicKey = keyPair.publicKey.toString();
    const secretKeyBuffer = Buffer.from(keyPair.secretKey);
    const secretKeyBase58 = bs58.encode(secretKeyBuffer);
    try {
        const savedKey = await prisma.order.create({
            data: {
                requestFrom : requestFrom,
                chatID : "",
                chain: chain,
                dex : dex,
                pairAddress : pairAddress,
                slot: slot,
                price: price,
                paymentMethod: paymentMethod,
                orderStatus : orderStatus,
                publickey: publicKey,
                secretKeyBase58: secretKeyBase58,
            }
        });
        //Get balance Loop
        //After 4 min if the result is zero then send the error message otherwise send
        checkResponse(publicKey,paymentMethod);
        res.json({savedKey, txhash});
        // const balance = await checkResponse(address,paymentMethod);
        //     return balance;
        // for (let elapsed = 0; elapsed < 240000; elapsed += 30000) {
        //     await new Promise(resolve => setTimeout(resolve, 30000));
        //     const balance = await checkResponse(address,paymentMethod);
        //     return balance;
        // }

    } catch (error) {
        console.error('Error saving keys to the database:', error);
        res.status(500).json({ error: 'Failed to save keys to the database' });
    }
});

async function getSOLBalance(address) {
    const connection = new Connection(clusterApiUrl('mainnet-beta'));
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    finalBalance = balance / 1000000000; 
    if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify('processing'));
        // wsClient.send(JSON.stringify({ userId: userId, balance: finalBalance }));
    } else {
        console.error('WebSocket is not open. Cannot send balance.');
    }

    return balance;
}

async function getTokenBalance(walletAddress) {
    const tokenMintAddress = 'BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC';
    const response = await axios({
        url: `https://api.mainnet-beta.solana.com`,
        method: "post",
        headers: { "Content-Type": "application/json" },
        data: {
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccountsByOwner",
            params: [
                walletAddress,
                { mint: tokenMintAddress },
                { encoding: "jsonParsed" },
            ],
        },
    });
    if (response.data.result && response.data.result.value.length > 0) {
        const tokenAmount = response.data.result.value[0].account.data.parsed.info.tokenAmount.amount;
        balance = Number(tokenAmount) / 1000000;
    if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify('processing'));
            // wsClient.send(JSON.stringify({ userId: userId, balance: balance }));
        } else {
            console.error('WebSocket is not open. Cannot send balance.');
        }

        return balance;
    } else {
        return 0;
    }
}


async function checkResponse(walletAddress,paymentMethod) {
    if (paymentMethod === "Monkeys") {
         getTokenBalance(walletAddress);
    }else{
        getSOLBalance(walletAddress);
    }
    return true;
}


wsClient.on('connection', function connection(ws) {
    console.log('A new client connected');


// ws.on('message', function incoming(message) {
//     console.log('received: %s', message);
// });
ws.on('open', function open() {
    console.log('WebSocket connection established');
});

});



server.listen(3000, () => {
    console.log('Server running on port 3000');
});
