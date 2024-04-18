const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

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


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
