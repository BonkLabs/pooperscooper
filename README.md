# Pooper Scooper

Solana web3 dapp that allows users to "clean" shit tokens out of their wallet and convert it all to bonk

A basic user interface and usage is implemented in `AssetList.tsx`.

The core logic which performs the application action is `in scooper.ts`

# Usage

Start the development server:
```
yarn start
```

Build artifacts for production deployment:
```
yarn build
```

# Notes

Note that the homepage is currently set in `package.json` for a development server and should be changed for other deployments

# TODO

   1 Add instruction into each transaction to close the associated token instruction
   2 (Optional) Implement referrer mechanism _or_ add another instruction to take a referral fee
   3 _fix UI.........._