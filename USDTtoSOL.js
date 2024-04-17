const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// Global variable to store the SOL price
let solPrice = null;
// Function to fetch SOL price from the API
async function fetchSolPrice() {
    const apiUrl = 'https://price.jup.ag/v4/price?ids=SOL';
    try {
        const response = await axios.get(apiUrl);
        solPrice = response.data.data.SOL.price;
        console.log(`Updated SOL Price: ${solPrice}`);
    } catch (error) {
        console.error('Failed to fetch SOL price:', error.message);
        solPrice = null; // Reset price on error to avoid using stale data
    }
}

// Endpoint to get the value in SOL for a given dollar amount
app.get('/amountSOL/:usd', (req, res) => {
    const usd = parseFloat(req.params.usd);
    if (isNaN(usd) || usd < 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid dollar amount'
        });
    }

    if (solPrice === null) {
        return res.status(503).json({
            success: false,
            message: 'SOL price not available. Try again later.'
        });
    }

    const solAmount = usd / solPrice;
    res.json({
        success: true,
        sol: solAmount
    });
});
fetchSolPrice();
setInterval(fetchSolPrice, 3000);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
