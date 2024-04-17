const express = require('express');
const axios = require('axios');
const cors = require('cors');  
const app = express();
const port = 3000;
app.use(cors()); 
app.use(express.json());

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

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
