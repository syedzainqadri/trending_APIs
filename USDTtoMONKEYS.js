const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

let solPrice = null;
let monkeysPrice = null; // Global variable to store the MONKEYS price

async function fetchSolPrice() {
    const apiUrl = 'https://price.jup.ag/v4/price?ids=SOL';
    try {
        const response = await axios.get(apiUrl);
        solPrice = response.data.data.SOL.price;
        console.log(`Updated SOL Price: ${solPrice}`);
    } catch (error) {
        console.error('Failed to fetch SOL price:', error.message);
        solPrice = null;
    }
}

async function fetchMonkeysPrice() {
    const apiUrl = 'https://price.jup.ag/v4/price?ids=BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC';
    try {
        const response = await axios.get(apiUrl);
        monkeysPrice = response.data.data.BAAagvYQvJ8NodiwFh8KwBGWCTRmwofPzP53K9Fc2TjC.price;
        console.log(`Updated MONKEYS Price: ${monkeysPrice}`);
    } catch (error) {
        console.error('Failed to fetch MONKEYS price:', error.message);
        monkeysPrice = null;
    }
}

app.get('/priceSOL/:usd', (req, res) => {
    const usd = parseFloat(req.params.usd);
    if (isNaN(usd) || usd < 0) {
        return res.status(400).json({ success: false, message: 'Invalid dollar amount' });
    }
    if (solPrice === null) {
        return res.status(503).json({ success: false, message: 'SOL price not available. Try again later.' });
    }
    const solAmount = usd / solPrice;
    res.json({ success: true, sol: solAmount });
});

app.get('/amountMONKEYS/:usdt', (req, res) => {
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

fetchSolPrice();
fetchMonkeysPrice();
setInterval(fetchSolPrice, 3000);
setInterval(fetchMonkeysPrice, 3000);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
