const express = require('express');
const axios = require('axios');
const { ethers } = require('ethers');
const cors = require('cors'); // Import cors module
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Convert USDT to BNB
async function convertUSDTtoBNB(usdtAmount) {
    try {
        const priceResponse = await axios.get('https://api.poloniex.com/markets/bnb_usdt/price');
        const bnbPricePerUsdt = parseFloat(priceResponse.data.price);
        return usdtAmount / bnbPricePerUsdt;
    } catch (error) {
        throw new Error("Error fetching BNB price: " + error.message);
    }
}

// Endpoint to convert USDT to BNB
app.post('/USDTtoBNB/:usdtAmount', async (req, res) => {
    const usdtAmount = parseFloat(req.params.usdtAmount);
    try {
        const bnbAmount = await convertUSDTtoBNB(usdtAmount);
        res.json({ bnb: bnbAmount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Send BNB to an address
const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const wallet = new ethers.Wallet("privatekey", provider);
app.post('/sendBNB', async (req, res) => {
    const { amount, toAddress } = req.body;
    try {
        const transaction = await wallet.sendTransaction({
            to: toAddress,
            value: ethers.utils.parseEther(amount.toString())
        });
        await transaction.wait();
        res.json({ success: true, transactionId: transaction.hash });
    } catch (error) {
        res.status(500).json({ message: "Failed to send BNB", error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
