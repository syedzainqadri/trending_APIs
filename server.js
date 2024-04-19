const express = require('express');
const { ethers } = require('ethers');
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());
const ethProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
const solanaConnection = new Connection(clusterApiUrl('mainnet-beta'));
const bscProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
const WebSocket = require('ws');
const web3 = require('@solana/web3.js');

app.post('/select-chain', async (req, res) => {
    const { chain } = req.body;
    try {
        switch (chain) {
            case 'eth':
                const ethChainId = await ethProvider.getNetwork().then(network => network.chainId);
                console.log("Ethereum network : ", ethChainId);
                res.json({ chainId: ethChainId });
                break;
            case 'sol':
                const solChainId = solanaConnection._rpcEndpoint;
                console.log("Solana network : ", solChainId);
                res.json({ chainId: solChainId });
                break;
            case 'bsc':
                const bscChainId = await bscProvider.getNetwork().then(network => network.chainId);
                console.log("Binance Smart Chain network : ", bscChainId);
                res.json({ chainId: bscChainId });
                break;
            default:
                res.status(400).json({ error: 'Invalid blockchain selected' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
const ranks = [
    ...Array.from({ length: 3 }, (_, i) => `Tier 1 Rank ${i + 1}`),  // Ranks 1-3
    ...Array.from({ length: 5 }, (_, i) => `Tier 2 Rank ${i + 4}`), // Ranks 4-8
    ...Array.from({ length: 30 }, (_, i) => `Any Tier Rank ${i + 1}`) // Ranks 1-30 for Any Tier
];
const bookedSlots = {};
app.get('/pairs/:chainId/:pairAddresses', async (req, res) => {
    const { chainId, pairAddresses } = req.params;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddresses}`;

    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Endpoint to get 1-hour transaction data for a specific pair
app.get('/txns/1h/:chainId/:pairAddress', async (req, res) => {
    const { chainId, pairAddress } = req.params;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`;

    try {
        const response = await axios.get(url);
        const txns = response.data.pair.txns.h1; // Extracting 1-hour transaction data
        res.json(txns);
    } catch (error) {
        console.error('Error fetching 1-hour transaction data:', error.message);
        res.status(500).json({ error: 'Failed to fetch 1-hour transaction data' });
    }
});


// Endpoint to get 5-minute volume data for a specific pair
app.get('/volume/m5/:chainId/:pairAddress', async (req, res) => {
    const { chainId, pairAddress } = req.params;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`;

    try {
        const response = await axios.get(url);
        const volume = response.data.pair.volume.m5; // Extracting 5-minute volume data
        res.json(volume);
    } catch (error) {
        console.error('Error fetching 5-minute volume data:', error.message);
        res.status(500).json({ error: 'Failed to fetch 5-minute volume data' });
    }
});

// Endpoint to get 1-hour volume data for a specific pair
app.get('/volume/h1/:chainId/:pairAddress', async (req, res) => {
    const { chainId, pairAddress } = req.params;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`;

    try {
        const response = await axios.get(url);
        const volume = response.data.pair.volume.h1; // Extracting 1-hour volume data
        res.json(volume);
    } catch (error) {
        console.error('Error fetching 1-hour volume data:', error.message);
        res.status(500).json({ error: 'Failed to fetch 1-hour volume data' });
    }
});

// Sample URL map for DEXs
const dexUrls = {
    "dextools": {
        "eth": "https://www.dextools.io/app/en/ether/pair-explorer",
        "bsc": "https://www.dextools.io/app/en/bsc/pair-explorer",
        "sol": "https://www.dextools.io/app/en/solana/pair-explorer"
    },
    "dexscreener": {
        "eth": "https://dexscreener.com/ethereum",
        "bsc": "https://dexscreener.com/bsc",
        "sol": "https://dexscreener.com/solana"
    }
};

app.post('/api/url', (req, res) => {
    const { dex, chain, slot, pairAddress } = req.body;
    if (!dex || !chain) {
        return res.status(400).send('Both dex and chain fields are required in the request body.');
    }
    const dexKey = dex.toLowerCase().replace(/\s+/g, '');
    const chainKey = chain.toLowerCase();
    const url = dexUrls[dexKey]?.[chainKey];
    if (!url) {
        return res.status(404).send('No URL found for the provided dex and chain combination.');
    }
    if (!bookedSlots[slot]) {
        bookedSlots[slot] = {};
    }
    if (bookedSlots[slot][dex]) {
        return res.status(409).json({ message: `Slot ${slot} for ${dex} is already booked. Try a different DEX or slot.` });
    }
    let slotFullyBooked = Object.keys(dexUrls).every(dexId => bookedSlots[slot][dexId]);
    if (slotFullyBooked) {
        return res.status(409).json({ message: `All DEXs are booked for slot ${slot}. Please choose a different slot.` });
    }
    bookedSlots[slot][dex] = true;
    res.json({ message: `Slot ${slot} successfully booked for ${dex}.`, url: `${url}/${pairAddress}` });
});

app.post('/USDTtoBNB/:usdtAmount', async (req, res) => {
    const usdtAmount = parseFloat(req.params.usdtAmount);
    try {
        const priceResponse = await axios.get('https://api.poloniex.com/markets/bnb_usdt/price');
        const bnbPricePerUsdt = parseFloat(priceResponse.data.price);
        const bnbAmount = usdtAmount / bnbPricePerUsdt;
        res.json({ bnb: bnbAmount });
    } catch (error) {
        res.status(500).json({ message: "Error fetching BNB price", error: error.message });
    }
});

app.post('/USDTtoETH/:usdtAmount', async (req, res) => {
    const usdtAmount = parseFloat(req.params.usdtAmount);
    try {
        const priceResponse = await axios.get('https://api.poloniex.com/markets/eth_usdt/price');
        const bnbPricePerUsdt = parseFloat(priceResponse.data.price);
        const bnbAmount = usdtAmount / bnbPricePerUsdt;
        res.json({ bnb: bnbAmount });
    } catch (error) {
        res.status(500).json({ message: "Error fetching BNB price", error: error.message });
    }
});

app.post('/USDTtoETH/:usdtAmount', async (req, res) => {
    const usdtAmount = parseFloat(req.params.usdtAmount);
    try {
        const priceResponse = await axios.get('https://api.poloniex.com/markets/sol_usdt/price');
        const bnbPricePerUsdt = parseFloat(priceResponse.data.price);
        const bnbAmount = usdtAmount / bnbPricePerUsdt;
        res.json({ bnb: bnbAmount });
    } catch (error) {
        res.status(500).json({ message: "Error fetching BNB price", error: error.message });
    }
});

let monkeysPrice = null;

// Fetch MONKEYS price periodically or on-demand to keep it updated
const fetchMonkeysPrice = async () => {
    const apiUrl = 'https://price.jup.ag/v4/price?ids=BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC';
    try {
        const response = await axios.get(apiUrl);
        monkeysPrice = response.data.data.BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC.price;
        console.log("MONKEYS price updated:", monkeysPrice);
    } catch (error) {
        console.error('Failed to fetch MONKEYS price:', error.message);
        monkeysPrice = null;
    }
};

// Call the function initially and periodically to keep the price updated
fetchMonkeysPrice();
setInterval(fetchMonkeysPrice, 300000); // Update every 5 minutes

app.get('/amountMONKEYS/:usdt', async (req, res) => {
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


// // Create a WebSocket server
// const wss = new WebSocket.Server({ port: 8080 });
// console.log('WebSocket server started on ws://localhost:8080');

// // Connect to the Solana cluster
// const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

// // Wallet address to monitor
// const publicKey = new web3.PublicKey('6Nd7JbuwazduUWKAV13bcSwB3DwpRwRVcDhKHuVhSnJA');

// async function getRecentTransactions() {
//     // Fetch the recent transaction signatures involving the wallet
//     const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
//     for (let signatureInfo of signatures) {
//         // Fetch detailed transaction information
//         const transaction = await connection.getTransaction(signatureInfo.signature);
//         // Broadcast transaction details to all connected WebSocket clients
//         wss.clients.forEach(client => {
//             if (client.readyState === WebSocket.OPEN) {
//                 client.send(JSON.stringify(transaction));
//             }
//         });
//     }
// }




// // Connect to Solana cluster
// const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

// // Function to handle new blocks
// async function handleBlock(block) {
//     console.log(`New block: ${block.blockHeight}`);
//     block.transactions.forEach(tx => {
//         console.log(`Transaction Hash: ${tx.transaction.signatures[0]}`);
//     });
// }

// // Subscribe to confirmed blocks
// const subscriptionId = connection.onSlotChange(async (slotInfo) => {
//     try {
//         const block = await connection.getBlock(slotInfo.slot);
//         if (block) {
//             handleBlock(block);
//         }
//     } catch (error) {
//         console.error('Error fetching block:', error);
//     }
// });

// console.log('Subscribed to new blocks. Listening for transactions...');
// // Poll every 30 seconds and broadcast updates
// setInterval(getRecentTransactions, 30000);

// Handle WebSocket connections
// wss.on('connection', function connection(ws) {
//     console.log('Client connected');
//     ws.on('message', function incoming(message) {
//         console.log('Received message from client: %s', message);
//     });

//     ws.on('close', function() {
//         console.log('Client disconnected');
//     });
// });


// Set the public key of the wallet you want to monitor
const publicKey = new web3.PublicKey('6Nd7JbuwazduUWKAV13bcSwB3DwpRwRVcDhKHuVhSnJA');

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server started on ws://localhost:8080');

// Connect to Solana cluster
const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'), 'confirmed');

let lastKnownSignature = null;

// This function fetches new transactions for the specified address
async function fetchTransactions() {
    const options = { limit: 10 };
    if (lastKnownSignature) {
        options.until = lastKnownSignature;
    }
    const signatures = await connection.getSignaturesForAddress(publicKey, options);
    if (signatures.length > 0) {
        lastKnownSignature = signatures[0].signature;  // Update the last known signature to the most recent
    }
    return Promise.all(signatures.map(signature => connection.getTransaction(signature.signature)));
}

// Broadcast new transactions to all connected WebSocket clients
async function broadcastNewTransactions() {
    try {
        const transactions = await fetchTransactions();
        if (transactions.length > 0) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(transactions));
                }
            });
        }
    } catch (error) {
        console.error('Error fetching or broadcasting transactions:', error);
    }
}

// Poll every 30 seconds
setInterval(broadcastNewTransactions, 30000);

// Handle WebSocket connections
wss.on('connection', function connection(ws) {
    console.log('Client connected');
    ws.on('message', function incoming(message) {
        console.log('Received message from client:', message);
    });

    ws.on('close', function() {
        console.log('Client disconnected');
    });
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
