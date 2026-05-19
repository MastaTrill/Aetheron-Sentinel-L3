const { Wallet } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function generateKeystore() {
    const privateKey = process.env.OWNER_PRIVATE_KEY;
    const password = process.env.KEYSTORE_PASSWORD;
    const outputDir = path.join(__dirname, '../keystores'); // Default output directory

    if (!privateKey) {
        console.error('Error: OWNER_PRIVATE_KEY not found in .env. Please set it.');
        process.exit(1);
    }
    if (!password) {
        console.error('Error: KEYSTORE_PASSWORD not found in .env. Please set it.');
        process.exit(1);
    }
    if (!privateKey.startsWith('0x')) {
        console.error('Error: OWNER_PRIVATE_KEY must start with "0x".');
        process.exit(1);
    }

    try {
        const wallet = new Wallet(privateKey);
        const address = await wallet.getAddress();

        console.log(`Encrypting wallet for address: ${address}...`);
        const encryptedJson = await wallet.encrypt(password);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = `keystore-${address}.json`;
        const outputPath = path.join(outputDir, filename);

        fs.writeFileSync(outputPath, encryptedJson);
        console.log(`✅ Keystore saved to: ${outputPath}`);
        console.log(`Remember to update your .env file with:`);
        console.log(`KEYSTORE_PATH=${outputPath}`);
        console.log(`KEYSTORE_PASSWORD=YOUR_PASSWORD_HERE (or keep it in .env for runtime)`);
        console.log(`And remove OWNER_PRIVATE_KEY from .env for enhanced security.`);

    } catch (error) {
        console.error('Failed to generate keystore:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    generateKeystore();
}