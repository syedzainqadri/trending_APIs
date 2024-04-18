const express = require('express');
const app = express();
const cors = require('cors');
const JSBI = require('jsbi');
const { TickMath, FullMath } = require('@uniswap/v3-sdk');
app.use(cors());
app.use(express.json());

// Function to calculate ETH price based on tick
function calculatePriceETH() {
    const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(-196021);
    const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96);
    const baseAmount = JSBI.BigInt(1 * (10 ** 18)); // 1 ETH in wei
    const shift = JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(192));
    const quoteAmount = FullMath.mulDivRoundingUp(ratioX192, baseAmount, shift);
    return parseFloat(quoteAmount.toString()) / (10 ** 6); // Convert wei to USDT unit
}

app.post("/priceETH", async (req, res) => {
    try {
        const calculatedQuoteAmount = calculatePriceETH();
        res.json({ quoteAmount: calculatedQuoteAmount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Function to calculate amount of ETH for given USDT amount
function calculateETHForUSDT(usdtAmount) {
    const usdtAmountBigInt = JSBI.BigInt(usdtAmount * (10 ** 6)); // Convert USDT to its smallest unit for precision
    const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(-196021);
    const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96);
    const shift = JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(192));
    const ethAmount = FullMath.mulDivRoundingUp(usdtAmountBigInt, shift, ratioX192);
    return parseFloat(ethAmount.toString()) / (10 ** 18); // Convert back from wei to ETH
}

app.post("/USDTtoETH/:usdtAmount", async (req, res) => {
    try {
        const usdtAmount = req.params.usdtAmount;
        if (isNaN(usdtAmount)) {
            throw new Error('Invalid USDT amount provided');
        }
        const calculatedEthAmount = calculateETHForUSDT(usdtAmount);
        res.json({ ethAmount: calculatedEthAmount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
