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
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server started on ws://localhost:8080');

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
        res.json({savedKey, txhash});
        for (let elapsed = 0; elapsed < 240000; elapsed += 30000) {
            await new Promise(resolve => setTimeout(resolve, 30000));
            const balance = await checkResponse(address);
            return balance;
        }
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
        wsClient.send(JSON.stringify({ userId: userId, balance: finalBalance }));
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
        //call loop to calculate
         // Check if WebSocket is open before sending data
    if (wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({ userId: userId, balance: balance }));
        } else {
            console.error('WebSocket is not open. Cannot send balance.');
        }

        return balance;
    } else {
        return 0;
    }
}


async function checkResponse(walletAddress) {
    if (paymentMethod === "Monkeys") {
         getTokenBalance(walletAddress);
    }else{
        getSOLBalance(walletAddress);
    }
    return true;
}




// const getBalances = async (address, paymentType) => {
//     if (paymentType === 'MONKEYS') {
//         const tokenMintAddress = 'BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC';
//         return getTokenBalance(address, tokenMintAddress);
//     } else {
//         return getSOLBalance(address);
//     }
// };

// async function getTransactionHistory(address) {
//     const connection = new Connection(clusterApiUrl('mainnet-beta'));
//     const publicKey = new PublicKey(address);
//     const confirmedSignatures = await connection.getConfirmedSignaturesForAddress2(publicKey);
//     return confirmedSignatures.map(signatureInfo => ({
//         signature: signatureInfo.signature,
//         slot: signatureInfo.slot,
//         blockTime: signatureInfo.blockTime ? new Date(signatureInfo.blockTime * 1000).toISOString() : 'unknown'
//     }));
// }


// async function updateTransactionStatus(chatID, status, transactionDetails = null) {
//     try {
//         const updatedTransaction = await prisma.update({
//             where: { chatID },
//             data: {
//                 status,
//                 transactionDetails: JSON.stringify(transactionDetails) // Storing details as JSON string
//             }
//         });
//         return updatedTransaction;
//     } catch (error) {
//         console.error('Failed to update transaction status:', error);
//         throw new Error('Error updating transaction status in the database');
//     }
// }

// wss.on('connection', ws => {
//     const orderData = prisma.order.findMany(
//         {
//             where: {
//                 orderStatus: 'open'
//             }
//         }
//     )
//     console.log(orderData);
//     ws.on('message', async data => {
//         let { chatID, price, paymentType, address, privateKey } = JSON.parse(data);
//         if (!chatID || !price || !paymentType || !address || !privateKey) {
//             ws.send(JSON.stringify({ error: 'Missing required parameters' }));
//             return;
//         }
//         let transactionStatus = 'open';
//         let timeout = setTimeout(async () => {
//             if (transactionStatus === 'open') {
//                 transactionStatus = 'transaction terminated';
//                 ws.send(JSON.stringify({ status: transactionStatus }));
//             }
//         }, 240000);
//         try {
//             for (let elapsed = 0; elapsed < 240000; elapsed += 30000) {
//                 await new Promise(resolve => setTimeout(resolve, 30000));
//                 const balance = await getBalances(address, paymentType);

//                 if (balance == price) {
//                     clearTimeout(timeout);
//                     transactionStatus = 'completed';
//                     const transactionDetails = await getTransactionHistory(address);
//                     await updateTransactionStatus(chatID, transactionStatus, transactionDetails);
//                     ws.send(JSON.stringify({ status: transactionStatus, details: transactionDetails }));
//                     // sendToFlaskApp(chatID, transactionDetails);
//                     break;
//                 } else if (elapsed + 30000 >= 240000) { 
//                     transactionStatus = 'refund';
//                     await updateTransactionStatus(chatID, transactionStatus);
//                     ws.send(JSON.stringify({
//                         chatID,
//                         address,
//                         privateKey,
//                         value: balance,
//                         status: transactionStatus
//                     }));
//                     break;
//                 }
//             }
//         } catch (error) {
//             ws.send(JSON.stringify({ error: 'Failed to process the transaction', details: error.message }));
//         }
//     });
// });

// wss.on('connection', function connection(ws) {
//     console.log('Client connected');

//         res.json(txhash, status);
//     });

//     ws.on('close', function() {
//         console.log('Client disconnected');
//     });


server.listen(3000, () => {
    console.log('Server running on port 3000');
});
