import { network } from 'hardhat';
import hre from 'hardhat';

async function main() {
  console.log("HRE KEYS:", Object.keys(hre));
  try {
    const connection = await network.create();
    console.log("CONNECTION KEYS:", Object.keys(connection));
  } catch (e) {
    console.log("Error creating connection:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
