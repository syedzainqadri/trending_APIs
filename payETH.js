const app = express();
const JSBI = require('jsbi');
const { TickMath, FullMath } = require('@uniswap/v3-sdk');
const { ethers } = require('ethers');
const cors = require('cors'); 
app.use(cors());
app.use(express.json());


const provider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/0414ba081803472dbf3a1feb7a76dc0e');
const wallet = new ethers.Wallet('take private key from user', provider);
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

app.post('/payETH/:usdtAmount/:toAddress', async (req, res) => {
    try {
        const { usdtAmount, toAddress } = req.params;

        // Validate the Ethereum address
        if (!ethers.utils.isAddress(toAddress)) {
            throw new Error('Invalid Ethereum address');
        }

        // Convert USDT to ETH using your existing function
        const ethAmount = calculateETHForUSDT(usdtAmount);
        const ethAmountInWei = ethers.utils.parseEther(ethAmount.toString());

        // Send ETH to the specified address
        const tx = await wallet.sendTransaction({
            to: toAddress,
            value: ethAmountInWei
        });

        // Wait for the transaction to be mined
        await tx.wait();

        res.json({ success: true, message: `Sent ${ethAmount} ETH to ${toAddress}`, transactionId: tx.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
