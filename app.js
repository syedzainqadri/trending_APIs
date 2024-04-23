const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const bs58 = require('bs58');
const cors = require('cors');
const axios = require('axios');
const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());
const { JsonRpcProvider } = require('ethers');
const ethProvider = new JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
const solanaConnection = new Connection(clusterApiUrl('mainnet-beta'));
const bscProvider = new JsonRpcProvider('https://bsc-dataseed.binance.org/');


app.post('/createSOL', async (req, res) => {
    console.log('create sol api hit')
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


app.get('/balance', async (req, res) => {
    console.log('balance api hit')
    const { paymentMethod, publicKey } = req.body;
    var currentBalance
        try {
            if (paymentMethod === "Monkeys") {
                currentBalance = await getTokenBalance(publicKey);
           }else{
            currentBalance = await getSOLBalance(publicKey);
           }
            console.log('Received payment:', currentBalance);
        } catch (e) {
            console.error('Error parsing message', e);
        }
        res.json({currentBalance});
});

app.post('/select-chain', async (req, res) => {
    console.log('select chain api hit')
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
app.get('/pairs/:chainId/:pairAddresses', async (req, res) => {
    console.log('validate pair addresses api hit')
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
    console.log('txns validation api hits')
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
    console.log('volume api hit')
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
    console.log('volume against pair address api hit')
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
    console.log('url api hit')
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
    console.log('price conversion api hit')
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
    console.log('usdt to eth api hit')
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
    console.log('Usdt toETH')
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
    console.log('amountMonkeys api hit')
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

