const express = require('express');
const { ethers } = require('ethers');
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(cors());

app.use(express.json());

// Pre-configured providers/connections
const ethProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
const solanaConnection = new Connection(clusterApiUrl('mainnet-beta'));
const bscProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

// Verify token address API

// Existing code for blockchain network selection
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


app.post('/verify-token', async (req, res) => {
    const { chain, tokenAddress } = req.body;

    try {
        switch (chain) {
            case 'eth':
            case 'bsc':
                const provider = chain === 'eth' ? ethProvider : bscProvider;
                const tokenContract = new ethers.Contract(tokenAddress, ['function balanceOf(address) view returns (uint)'], provider);
                try {
                    await tokenContract.balanceOf('0x0000000000000000000000000000000000000000');
                    res.json({ valid: true });
                } catch (error) {
                    res.json({ valid: false, reason: "No contract at this address or contract does not comply with expected interface." });
                }
                break;
            case 'sol':
                if (PublicKey.isOnCurve(tokenAddress)) {
                    try {
                        const accountInfo = await solanaConnection.getAccountInfo(new PublicKey(tokenAddress));
                        const isValid = accountInfo && accountInfo.owner.toString() === 'TokenkegQfeZxi3kCk6qPLiM6DHu3UcbwRqrWfzX8exF';
                        res.json({ valid: isValid });
                    } catch (error) {
                        res.json({ valid: false, reason: "Failed to fetch account info." });
                    }
                } else {
                    res.json({ valid: false, reason: "Invalid Solana address format." });
                }
                break;
            default:
                res.status(400).json({ error: 'Invalid blockchain selected' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Existing code for blockchain network selection
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
    ...Array.from({ length: 3 }, (_, i) => `Tier 1 Rank ${i + 1}`),
    ...Array.from({ length: 6 }, (_, i) => `Tier 2 Rank ${i + 4}`),
    ...Array.from({ length: 7 }, (_, i) => `Tier 3 Rank ${i + 10}`),
    ...Array.from({ length: 30 }, (_, i) => `Any Tier Rank ${i + 1}`)
];

app.post('/rank/:rank', (req, res) => {
    const { rank } = req.params;
    const rankIndex = parseInt(rank) - 1; // Convert rank to an array index

    if (rankIndex < 0 || rankIndex >= ranks.length || isNaN(rankIndex)) {
        return res.status(404).send('Rank not found');
    }

    const selectedRank = ranks[rankIndex];
    console.log(selectedRank);
    res.send({ rank: selectedRank });
});

const urlMap = {
    'dexscreener': 'dexscreener.com/',
    'dextools': 'www.dextools.io/app/en/pairs',
};

// API endpoint to get dex
app.get('/dex', (req, res) => {
    const platform = req.query.platform;
    if (urlMap[platform]) {
        console.log(`URL for ${platform}: ${urlMap[platform]}`);
        res.send(urlMap[platform]);
    } else {
        res.status(404).send('Platform not found');
    }
});

// API endpoint to check slot and dex
const bookedSlots = {};
app.post('/check', (req, res) => {
    const { dex, slot } = req.body;
    const availableDexs = Object.keys(urlMap);
    if (!bookedSlots[slot]) {
        bookedSlots[slot] = {};
    }

    if (bookedSlots[slot][dex]) {
        res.status(409).json({ message: `Slot ${slot} for ${dex} is already booked. Try a different DEX or slot.` });
    } else {
        let slotFullyBooked = true;
        for (let availableDex of availableDexs) {
            if (!bookedSlots[slot][availableDex]) {
                slotFullyBooked = false;
                break;
            }
        }

        if (slotFullyBooked) {
            res.status(409).json({ message: `All DEXs are booked for slot ${slot}. Please choose a different slot.` });
        } else {
            bookedSlots[slot][dex] = true;
            res.json({ message: `Slot ${slot} successfully booked for ${dex}.` });
        }
    }
});

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

const dexUrls = {
    "dextools": {
        "eth": "www.dextools.io/app/en/ether/pairs",
        "bsc": "www.dextools.io/app/en/bnb/pairs",
        "sol": "www.dextools.io/app/en/solana/pairs"
    },
    "dexscreener": {
        "eth": "dexscreener.com/ethereum",
        "bsc": "dexscreener.com/bsc",
        "sol": "dexscreener.com/solana"
    }
};

app.post('/api/url', (req, res) => {
    const { dex, chain } = req.body; // Read from the body, not the params

    if (!dex || !chain) {
        return res.status(400).send('Both dex and chain fields are required in the request body.');
    }

    const dexKey = dex.toLowerCase().replace(/\s+/g, ''); // Normalize input
    const chainKey = chain.toLowerCase();

    const url = dexUrls[dexKey]?.[chainKey];

    if (url) {
        res.json({ url }); // Use json to ensure proper content type
    } else {
        res.status(404).send('No URL found for the provided dex and chain combination.');
    }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
