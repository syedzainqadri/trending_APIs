const express = require('express');
const cors = require('cors');
// CORS options, adjust 'origin' as needed for security
const corsOptions = {
    origin: '*',  // This allows all domains. For production, set specific domains or use a function to validate.
    optionsSuccessStatus: 200 // For legacy browser support
  };
const { PrismaClient } = require('@prisma/client');
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const bs58 = require('bs58');
const axios = require('axios');
const http = require('http');
const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors(corsOptions));
const WebSocket = require('ws');
// const wss = new WebSocket('ws://bot.monkeyslist.io:8080');
const wss = new WebSocket.Server({port: 8080});
const { ethers } = require('ethers');
const ethProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
const solanaConnection = new Connection(clusterApiUrl('mainnet-beta'));
const bscProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');


app.post('/createSOL', cors(), async (req, res) => {
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
        res.json({savedKey});

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
    return finalBalance;
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


wss.on('connection', function connection(socket) {
    socket.on('message', async function incoming(message) {
        // Parse the message back into an object
        var currentBalance
        try {
            const params = JSON.parse(message);
           
            if (params.paymentMethod === "Monkeys") {
                currentBalance = await getTokenBalance(params.publicKey);
           }else{
            currentBalance = await getSOLBalance(params.publicKey);
           }
            console.log('Received payment:', currentBalance);

            // You can now use these parameters to perform actions
            if (params.action === 'sendBal') {
                ws.send(JSON.stringify(currentBalance));
            }
        } catch (e) {
            console.error('Error parsing message', e);
        }
    });
});


app.post('/select-chain', cors(), async (req, res) => {
    // console.log(req.body)
    const { chain } = req.body;
    console.log(chain)
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
app.get('/pairs/:chainId/:pairAddresses', cors(), async (req, res) => {
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
app.get('/txns/1h/:chainId/:pairAddress', cors(), async (req, res) => {
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
app.get('/volume/m5/:chainId/:pairAddress', cors(), async (req, res) => {
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
app.get('/volume/h1/:chainId/:pairAddress', cors(), async (req, res) => {
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

app.post('/api/url', cors(), (req, res) => {
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

app.post('/USDTtoBNB/:usdtAmount', cors(), async (req, res) => {
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

app.post('/USDTtoETH/:usdtAmount', cors(), async (req, res) => {
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

app.post('/USDTtoETH/:usdtAmount', cors(), async (req, res) => {
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

app.get('/amountMONKEYS/:usdt', cors(), async (req, res) => {
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

app.get('/', async (req, res) => {

        res.json('hello world');
   
});


server.listen(3000, () => {
    console.log('Server running on port 3000');
});
