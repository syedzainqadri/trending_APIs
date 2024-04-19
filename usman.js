const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const bs58 = require('bs58');
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


app.use(express.json());
app.use(cors());
app.get('/createSOL', (req, res) => {
    const keyPair = Keypair.generate();
    const publicKey = keyPair.publicKey.toString();
    const secretKeyBuffer = Buffer.from(keyPair.secretKey);
    const secretKeyBase58 = bs58.encode(secretKeyBuffer);
    //save everything to db
    res.json({ publicKey, secretKeyBase58 });
});

const getBalance = async (address, paymentType) => {
    const connection = new Connection(clusterApiUrl('mainnet-beta'));
    try {
        const publicKey = new PublicKey(address);
        if (paymentType === 'SOL') {
            const balance = await connection.getBalance(publicKey);
            return balance / 1e9; // Convert lamports to SOL
        } else {
            const tokenMintAddress = 'YourTokenMintAddressHere'; // Replace with actual mint address
            return await getTokenBalance(address, tokenMintAddress);
        }
    } catch (error) {
        console.error('Error getting balance:', error);
        throw new Error('Failed to get balance');
    }
};



app.get('/SOLbalance/:address', async (req, res) => {
    try {
        const balance = await getBalance(req.params.address, 'SOL');
        res.json({ address: req.params.address, balance: balance + ' SOL' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// if balance is found
// WebSocket for handling transaction submissions
wss.on('connection', ws => {
    ws.on('message', async data => {
        let { chatID, price, paymentType, address, privateKey } = JSON.parse(data);

        if (!chatID || !price || !paymentType || !address) {
            ws.send(JSON.stringify({ error: 'Missing required parameters' }));
            return;
        }

        try {
            const balance = await getBalance(address, paymentType);
            let transactionStatus = 'open';
            setTimeout(() => {
                transactionStatus = 'transaction terminated';
                ws.send(JSON.stringify({ status: transactionStatus }));
            }, 240000); // 4 minutes timeout

            //if balance true
            // tele with order amount


            if (balance >= price) {
                transactionStatus = 'completed';
                //staus must be updated in db as well. then fetch the transaction details from db and send transaction
                ws.send(JSON.stringify({ status: transactionStatus }));
                //send this order to our flask app to run.
            } else {
                //balance is not true and transaction is not completed then trigger refund send private / public key plus amount to be refunded. 
                transactionStatus = 'refund';
                //update status in db.
                ws.send(JSON.stringify({
                    chatID,
                    address,
                    privateKey,
                    value: balance,
                    status: transactionStatus
                }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ error: 'Failed to process the transaction' }));
        }
    });
});

// app.get('/createETH', (req, res) => {
//     const wallet = ethers.Wallet.createRandom();
//     const response = {
//         privateKey: wallet.privateKey,
//         address: wallet.address
//     };
//     res.json(response);
// });

// app.get('/createBNB', (req, res) => {
//     const wallet = ethers.Wallet.createRandom();
//     const response = {
//         privateKey: wallet.privateKey,
//         address: wallet.address
//     };
//     res.json(response);
// });


// app.get('/ETHbalance/:address', async (req, res) => {
//     const { address } = req.params;
//     const provider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
//     try {
//         const balance = await provider.getBalance(address);
//         const ethBalance = ethers.utils.formatEther(balance);
//         res.send({ address, balance: ethBalance + ' ETH' });
//     } catch (error) {
//         res.status(500).send({ error: error.message });
//     }
// });

// app.get('/BNBbalance/:address', async (req, res) => {
//     const { address } = req.params;
//     const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
//     try {
//         const balance = await provider.getBalance(address);
//         const bnbBalance = ethers.utils.formatEther(balance);
//         res.send({ address, balance: bnbBalance + ' BNB' });
//     } catch (error) {
//         res.status(500).send({ error: error.message });
//     }
// });


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

