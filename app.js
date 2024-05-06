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

async function convertBs58ToUint8Array(secretBs58Key) {
    if (typeof secretBs58Key !== 'string') {
        throw new Error('Invalid input type: secretBs58Key must be a string.');
    }
    try {
        return new Uint8Array(bs58.decode(secretBs58Key));
    } catch (error) {
        throw new Error('Failed to decode and convert the key: ' + error.message);
    }
}


async function getSOLBalance(walletAddress) {
    try {
        const publicKey = new PublicKey(walletAddress);
        const balanceLamports = await solanaConnection.getBalance(publicKey);
        const balanceSol = balanceLamports / 1_000_000_000; // Convert lamports to SOL
        return balanceSol.toFixed(2) + ' SOL'; // Format the balance to two decimal places and append "SOL"
    } catch (error) {
        console.error("Failed to get the balance:", error);
        throw error;
    }
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
app.get('/pairs/:chainId/:pairAddresses', async (req, res) => {
    console.log('Validate pair addresses API hit');
    const { chainId, pairAddresses } = req.params;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddresses}`;

    try {
        const response = await axios.get(url);
        const volume = response.data.pair.volume.h24;
        if (response.data && response.data.pairs) {
            const pairsData = response.data.pairs.map(pair => ({
                pairAddress: pair.pairAddress,
                blockchain: pair.chain,
                baseToken: pair.baseToken.name, 
                quoteToken: pair.quoteToken.name, 
                volume24h: volume
            }));
            res.json(pairsData);
        } else {
            throw new Error("Invalid API response structure");
        }
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

const dexUrls = {
    "dextools": "https://www.dextools.io/app/en/",
    "dexscreener": "https://dexscreener.com/"
};

const bookedSlots = {};

app.post('/api/url', (req, res) => {
    console.log('URL API hit');
    const { dex, chain, slot, pairAddress } = req.body;

    if (!dex || !chain || !['1-3', '4-8', 'any'].includes(slot)) {
        return res.status(400).send('Dex, chain, and a valid slot (1-3, 4-8, any) are required.');
    }
    
    const dexKey = dex.toLowerCase().replace(/\s+/g, '');
    const chainKey = chain.toLowerCase(); // chainKey is declared but not used
    const url = dexUrls[dexKey];

    if (!url) {
        return res.status(404).send('No URL found for the provided dex and chain combination.');
    }

    if (!bookedSlots[slot]) {
        bookedSlots[slot] = {};
    }

    if (bookedSlots[slot][dexKey]) {
        return res.status(409).json({ message: `Slot ${slot} for ${dex} is already booked. Try a different DEX or slot.` });
    }

    bookedSlots[slot][dexKey] = true;
    // Schedule to clear the slot after 3 hours (10,800,000 milliseconds)
    setTimeout(() => {
        delete bookedSlots[slot][dexKey];
        console.log(`Slot ${slot} for ${dex} has been released.`);
    }, 10800000);

    res.json({ 
        message: `Slot ${slot} successfully booked for ${dex}.`,
        dex: dex,
        chain: chain,
        pairAddress: pairAddress,
        url: url // Adding the DEX URL to the response
    });
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

async function getMonkeysAmount(usdtAmount) {
    try {
        // Call the external API to get the current SOL price in USDT
        const response = await axios.get('https://price.jup.ag/v4/price?ids=BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC');
        const pricePerSOL = response.data.data.BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC.price;
        
        // Calculate the amount of SOL that can be bought with the given USDT
        const solAmount = usdtAmount / pricePerSOL;
        
        return { success: true, solAmount };
    } catch (error) {
        console.error('Error fetching SOL price:', error);
        return { success: false, error: 'Failed to fetch price' };
    }
}
async function getSolAmount(usdtAmount) {
    try {
        const response = await axios.get('https://price.jup.ag/v4/price?ids=So11111111111111111111111111111111111111112');
        const pricePerSOL = response.data.data.So11111111111111111111111111111111111111112.price;
        const solAmount = usdtAmount / pricePerSOL;
        return { success: true, solAmount };
    } catch (error) {
        console.error('Error fetching SOL price:', error);
        return { success: false, error: 'Failed to fetch price' };
    }
}

async function getDiscountedMonkeysValue(usdtAmount) {
    try {
        const response = await axios.get('https://price.jup.ag/v4/price?ids=BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC');
        const pricePerSOL = response.data.data.BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC.price;
        const solAmount = usdtAmount / pricePerSOL;
        const discountedMonkeysValue = solAmount * 0.8; // Apply a 20% discount
        return { success: true, discountedMonkeysValue };
    } catch (error) {
        console.error('Error fetching SOL price:', error);
        return { success: false, error: 'Failed to fetch price' };
    }
}

app.post('/conversion', async (req, res) => {
    const { paymentType, usdtAmount } = req.body;
    try {
        if (paymentType === 'Sol') {
            const { success, solAmount } = await getSolAmount(usdtAmount);
            if (success) {
                res.json({ paymentType, amount: solAmount });
            } else {
                throw new Error('Failed to fetch SOL amount');
            }
        } else if (paymentType === 'Monkeys') {
            const { success, discountedMonkeysValue } = await getDiscountedMonkeysValue(usdtAmount);
            if (success) {
                res.json({ paymentType, amount: discountedMonkeysValue });
            } else {
                throw new Error('Failed to fetch discounted Monkeys value');
            }
        } else {
            res.status(400).json({ success: false, error: 'Invalid payment type' });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/getSOLBalance/:walletAddress', async (req, res) => {
    try {
        const publicKey = new PublicKey(req.params.walletAddress);
        const balance = await getSOLBalance(publicKey);
        res.status(200).send({ balance: balance });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/getTokenBalance/:walletAddress', async (req, res) => {
    const walletAddress = req.params.walletAddress;
    const balance = await getTokenBalance(walletAddress);
    res.json({ balance });
});

app.get('/createWallet', (req, res) => {
    const keyPair = Keypair.generate();
    const publicKey = keyPair.publicKey.toString();
    const secretKeyBuffer = Buffer.from(keyPair.secretKey);
    const secretKeyBase58 = bs58.encode(secretKeyBuffer);
    res.json({ publicKey, secretKeyBuffer,secretKeyBase58 });
});

app.post('/apiData', (req, res) => {
    console.log('URL API hit');
    const { dex, chain, slot, pairAddress,paymentMethod,secretKeyBase58 } = req.body;

    if (!dex || !chain || !['1-3', '4-8', 'any'].includes(slot)) {
        return res.status(400).send('Dex, chain, and a valid slot (1-3, 4-8, any) are required.');
    }
    
    const dexKey = dex.toLowerCase().replace(/\s+/g, '');
    const chainKey = chain.toLowerCase();
    const url = dexUrls[dexKey];

    if (!url) {
        return res.status(404).send('No URL found for the provided dex and chain combination.');
    }

    if (!bookedSlots[slot]) {
        bookedSlots[slot] = {};
    }

    if (bookedSlots[slot][dexKey]) {
        return res.status(409).json({ message: `Slot ${slot} for ${dex} is already booked. Try a different DEX or slot.` });
    }

    bookedSlots[slot][dexKey] = true;
    // Schedule to clear the slot after 3 hours (10,800,000 milliseconds)
    setTimeout(() => {
        delete bookedSlots[slot][dexKey];
        console.log(`Slot ${slot} for ${dex} has been released.`);
    }, 10800000);

    res.json({ 
        message: `Slot ${slot} successfully booked for ${dex}.`,
        dex: dex,
        chain: chain,
        pairAddress: pairAddress,
        url: url ,
        paymentMethod : paymentMethod,
        secretKeyBase58 : secretKeyBase58

    });
});

app.get('/', async (req, res) => {
    console.log('hello world')
        res.json('hello world');
   
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
