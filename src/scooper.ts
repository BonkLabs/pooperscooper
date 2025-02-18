import {
  Connection,
  GetProgramAccountsFilter,
  VersionedTransaction,
  sendAndConfirmRawTransaction,
  PublicKey,
  TransactionMessage,
  TransactionInstruction,
  AddressLookupTableAccount
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  createHarvestWithheldTokensToMintInstruction,
  createBurnInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import {
  SwapInstructionsResponse,
  DefaultApi,
  QuoteResponse
} from '@jup-ag/api';

import {
  QuoteGetRequest,
  SwapPostRequest,
  createJupiterApiClient
} from '@jup-ag/api';

interface TokenInfo {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
  tags: string[];
  strict?: boolean;
}

interface Asset {
  asset: TokenBalance;
  quote?: QuoteResponse;
  swap?: SwapInstructionsResponse;
  checked?: boolean;
  usdPrice?: number;
}

interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  programId: PublicKey;
  ataId: PublicKey;
}

const BIRDEYE_API_KEY = '770da6127cd0451881d3e154788bc68b';

const BONK_TOKEN_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

const liquidStableTokens = ["mSOL", "JitoSOL", "bSOL", "mrgnLST", "jSOL", "stSOL", "scnSOL", "LST"];
const forbiddenTokens = ["Bonk", "USDC", "USDT"].concat(liquidStableTokens);

const distributionTargets: [PublicKey, number][] = [
  [
    getAssociatedTokenAddressSync(
      new PublicKey(BONK_TOKEN_MINT),
      new PublicKey("CbX9HYvyHBa2RuotGN8Y8hCKow6xppdrhAh6RL6i2BEf") // mike7c2 fees
    ),
    0.22999999999999998 // 0.22999999999999998%
  ],
  [
    getAssociatedTokenAddressSync(
      new PublicKey(BONK_TOKEN_MINT),
      new PublicKey("5sjjuNuf1f2kEL4UtyT6fxiqzk6ddi9yojXNUoLxNQ1Q") // infra maintenance fees
    ),
    0.22999999999999998 // 0.22999999999999998%
  ],
  [
    getAssociatedTokenAddressSync(
      new PublicKey(BONK_TOKEN_MINT),
      new PublicKey("2Vi8WzFHAAVNjtAquByvdzzpw8p4MuXhkQyBxs4qSVxw") // bonk fees
    ),
    0.22999999999999998 // 0.22999999999999998%
  ]
];

/**
 * Get the total fee amount
 */
function getTotalFee(): number {
  let totalFee = 0.0;
  distributionTargets.forEach(([target, feePercent]) => {
    totalFee += feePercent;
  });
  return totalFee;
}

/**
 * Returns the expected outputs of burning an asset
 *
 * @param asset The asset to calculate returns for
 * @returns Object containing information about return/fees
 */
function getAssetBurnReturn(asset: Asset): { burnAmount: bigint, bonkAmount: bigint, lamportsAmount: bigint, feeAmount: bigint } {
  var burnAmount: bigint;
  var bonkAmount: bigint;
  var lamportsAmount: bigint;

  if (asset.quote) {
    burnAmount = asset.asset.balance - BigInt(asset.quote.inAmount);
    bonkAmount = BigInt(asset.quote.outAmount);
    if (asset.asset.programId == TOKEN_2022_PROGRAM_ID) {
      lamportsAmount = BigInt(0);
    } else {
      lamportsAmount = BigInt(2400000);
    }
  } else {
    burnAmount = asset.asset.balance;
    bonkAmount = BigInt(0);
    lamportsAmount = BigInt(2400000);
  }

  let totalFee = getTotalFee();

  let feeAmount = bonkAmount / BigInt(Math.floor(100 / totalFee));
  bonkAmount -= feeAmount;

  return {
    burnAmount: burnAmount,
    bonkAmount: bonkAmount,
    lamportsAmount: lamportsAmount,
    feeAmount: feeAmount
  }
}

async function getMintInfo(mints: string[], solanaConnection: Connection): Promise<any> {
  const response = await fetch(solanaConnection.rpcEndpoint, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "id": "BONKscooper",
      "jsonrpc": "2.0",
      "method": "getAssetBatch",
      "params": {
        "ids": mints
      }
    }),
  });
  const data = await response.json();
  return data;
}
/**
 * Gets token accounts including standard and token22 accounts
 *
 * Returns a list of all token accounts which match a "known" token in tokenList
 *
 * @param wallet - The users public key as a string
 * @param connection - The connection to use
 * @param tokenList - List of all known tokens
 * @returns A List of TokenBalances containing information about tokens held by the user and their balances
 */
async function getTokenAccounts(
  wallet: string,
  solanaConnection: Connection,
  tokenList: { [id: string]: TokenInfo }
): Promise<TokenBalance[]> {

  const response = await fetch(solanaConnection.rpcEndpoint, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "id": "BONKscooper",
      "jsonrpc": "2.0",
      "method": "getTokenAccounts",
      "params": {
        "owner": wallet,
        "page": 1,
        "limit": 1000,
        "options": {}
      }
    }),
  });
  const data = await response.json();
  const tokenAccounts = data.result.token_accounts;
  var tokens: TokenBalance[] = [];

  const mintAddresses = tokenAccounts.map((account: any) => account.mint);

  const mintInfo = await getMintInfo(mintAddresses, solanaConnection);

  tokenAccounts.forEach((account: any, i: number) => {
    if (tokenList[account.mint] && !forbiddenTokens.includes(tokenList[account.mint].symbol)) {
      const thisMint = mintInfo.result.find((mintInfo: any) => account.mint === mintInfo.id);

      tokens.push({
        token: tokenList[account.mint],
        balance: BigInt(account.amount),
        programId: thisMint.token_info.token_program,
        ataId: new PublicKey(account.address)
      });
    }
  });

  return tokens;
}

const deserializeInstruction = (instruction: any) => {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable
    })),
    data: Buffer.from(instruction.data, 'base64')
  });
};

async function getAddressLookupTableAccounts(
  connection: Connection,
  keys: string[]
): Promise<AddressLookupTableAccount[]> {
  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      keys.map((key) => new PublicKey(key))
    );

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index];
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data)
      });
      acc.push(addressLookupTableAccount);
    }

    return acc;
  }, new Array<AddressLookupTableAccount>());
}

/**
 * Builds a transaction which includes:
 *  Swap instruction + supporting instructions if a swap is present
 *  Burn Tokens/Harvest witheld to mint if a swap is using token 2022 standard
 *  Close account instruction
 *
 * Note that this function can be slow as it must `getAddressLookupTableAccounts` which involves fetching on chain data
 *
 * @param wallet - The users public key as a string
 * @param connection - The connection to use
 * @param blockhash - Recent blockhash to use in making transaction
 * @param asset - The asset to build a transaction for
 * @returns Transaction if there are any instructions to execute, else null
 */
async function buildBurnTransaction(
  wallet: WalletContextState,
  connection: Connection,
  blockhash: string,
  asset: Asset
): Promise<VersionedTransaction | null> {
  if (asset.checked && wallet.publicKey) {
    var instructions: TransactionInstruction[] = [];
    var lookup = undefined;
    if (asset.swap) {
      asset.swap.computeBudgetInstructions.forEach((computeIx) => {
        if (!asset.swap) {
          return;
        }
        instructions.push(deserializeInstruction(computeIx));
      });

      asset.swap.setupInstructions.forEach((setupIx) => {
        if (!asset.swap) {
          return;
        }
        instructions.push(deserializeInstruction(setupIx));
      });

      instructions.push(deserializeInstruction(asset.swap.swapInstruction));

      const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

      addressLookupTableAccounts.push(
        ...(await getAddressLookupTableAccounts(
          connection,
          asset.swap.addressLookupTableAddresses
        ))
      );
      lookup = addressLookupTableAccounts;
    }

    let burnAmount;
    if (asset.quote && asset.swap) {
      burnAmount = asset.asset.balance - BigInt(asset.quote.inAmount);
    } else {
      // if worth more than $10, return null
      const balanceNoDecimals = Number(asset.asset.balance) / Math.pow(10, asset.asset.token.decimals);
      const tokenValue = await fetchUsdPrice(asset.asset.token.address, Number(balanceNoDecimals));
      console.log(`Token value for ${asset.asset.token.symbol}: ${tokenValue}`);
      if ((tokenValue && tokenValue > 1) || !tokenValue) {
        return null;
      }

      burnAmount = asset.asset.balance;
    }

    if (burnAmount > 0) {
      console.log('Adding burn instruction');
      const burnIx = createBurnInstruction(
        asset.asset.ataId,
        new PublicKey(asset.asset.token.address),
        wallet.publicKey,
        burnAmount,
        [],
        asset.asset.programId
      );
      instructions.push(burnIx);
    }

    if (asset.asset.programId == TOKEN_2022_PROGRAM_ID && !asset.swap) {
      console.log('Adding harvest instruction');
      const harvestFeesIx = createHarvestWithheldTokensToMintInstruction(
        new PublicKey(asset.asset.token.address),
        [asset.asset.ataId],
        TOKEN_2022_PROGRAM_ID
      );
      instructions.push(harvestFeesIx);
    }
    if (asset.asset.programId != TOKEN_2022_PROGRAM_ID || !asset.swap) {
      console.log('Adding closeAccountInstruction');
      const closeAccountIx = createCloseAccountInstruction(
        asset.asset.ataId,
        wallet.publicKey,
        wallet.publicKey,
        [],
        asset.asset.programId
      );
      instructions.push(closeAccountIx);
    }

    distributionTargets.forEach(([target, sharePercent]) => {
      if (
        wallet.publicKey && asset.quote && asset.swap &&
        (BigInt(asset.quote.outAmount) / BigInt(Math.floor(100 / sharePercent))) > 0n
      ) {
        const transferInstruction = createTransferInstruction(
          getAssociatedTokenAddressSync(
            new PublicKey(BONK_TOKEN_MINT),
            wallet.publicKey
          ),
          target,
          wallet.publicKey,
          (BigInt(asset.quote.outAmount) / BigInt(Math.floor(100 / sharePercent)))
        );
        instructions.push(transferInstruction);
      }
    });

    console.log(instructions);
    if (instructions.length > 0) {
      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: instructions
      }).compileToV0Message(lookup);
      const tx = new VersionedTransaction(message);
      console.log('Created transaction');
      console.log(tx);
      return tx;
    }
  }
  return null;
}

async function fetchUsdPrice(tokenAddress: string, amount: number): Promise<number | null> {
  try {
    const response1 = await fetch(
      `${process.env.REACT_APP_BONK_API_URL}/api/price?address=${tokenAddress}`,);

    const responseData1 = await response1.json();
    return responseData1.data.value * amount;
  } catch (e) {
    console.log(`Failed to fetch price for ${tokenAddress}`);
    console.log(e);
  }

  return null;
}

/**
 * Sweeps a set of assets, signing and executing a set of previously determined transactions to swap them into the target currency
 *
 * @param wallet - The users public key as a string
 * @param connection - The connection to use
 * @param assets - List of the assets to be swept
 * @param transactionStateCallback - Callback to notify as a transactions state updates
 * @param transactionIdCallback - Callback to notify when a transaction has an ID
 * @param transactionIdCallback - Callback to notify on errors
 * @returns void Promise, promise returns when all actions complete
 */
async function sweepTokens(
  wallet: WalletContextState,
  connection: Connection,
  assets: Asset[],
  transactionStateCallback: (id: string, state: string) => void,
  transactionIdCallback: (id: string, txid: string) => void,
  errorCallback: (id: string, error: any) => void
): Promise<void> {
  const transactions: [string, VersionedTransaction][] = [];
  const blockhash = await (await connection.getLatestBlockhash()).blockhash;

  await Promise.all(
    assets.map(async (asset) => {
      const tx = await buildBurnTransaction(
        wallet,
        connection,
        blockhash,
        asset
      );
      if (tx) {
        transactions.push([asset.asset.token.address, tx]);
      }
    })
  );

  console.log('Transactions');
  console.log(transactions);

  // for (let i = 0; i < transactions.length; i++) {
  //   const simulate = await connection.simulateTransaction(transactions[i][1]);
  //   console.log('Simulated transaction:');
  //   console.log(simulate);
  // }

  if (wallet.signAllTransactions) {
    const signedTransactions = await wallet.signAllTransactions(
      transactions.map(([id, transaction]) => transaction)
    );

    console.log('Signed transactions:');
    console.log(signedTransactions);
    console.log(transactions);

    await Promise.all(
      signedTransactions.map(async (transaction, i) => {
        const assetId = transactions[i][0];
        transactionStateCallback(assetId, 'Scooping');

        try {
          const result = await sendAndConfirmRawTransaction(
            connection,
            Buffer.from(transaction.serialize()),
            {}
          );
          console.log('Transaction Success!');
          transactionStateCallback(assetId, 'Scooped');
          transactionIdCallback(assetId, result);
        } catch (err) {
          console.log('Transaction failed!');
          console.log(err);
          transactionStateCallback(assetId, 'Error');
          errorCallback(assetId, err);
        }
      })
    );
  }
}

/**
 * Get quotes and transaction data to swap input currencies into output currency
 *
 * @param connection - The connection to use
 * @param tokens - The tokens to seek quotes for
 * @param outputMint - The Mint for the output currency
 * @param walletAddress - Callback to notify when a transaction has an ID
 * @param quoteApi - Users wallet address
 * @param foundAssetCallback - Callback to notify when an asset held by the user has been found
 * @param foundQuoteCallback - Callback to notify when a quote for the user asset has been found
 * @param foundSwapCallback - Callback to notify when the swap transaction details for the user asset has been found
 * @param errorCallback - Callback to notify on errors
 * @returns void Promise, promise returns when all actions complete
 */
async function findQuotes(
  connection: Connection,
  tokens: { [id: string]: TokenInfo },
  outputMint: string,
  walletAddress: string,
  quoteApi: DefaultApi,
  foundAssetCallback: (id: string, asset: TokenBalance) => void,
  foundQuoteCallback: (id: string, quote: QuoteResponse) => void,
  foundSwapCallback: (id: string, swap: SwapInstructionsResponse) => void,
  foundUsdCallback: (id: string, amount: number) => void,
  errorCallback: (id: string, err: string) => void
): Promise<void> {
  const assets = await getTokenAccounts(walletAddress, connection, tokens);

  // await Promise.all(
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (asset.balance == 0n) {
      continue;
    }

    // assets.map(async (asset) => {
    console.log('Found asset');
    foundAssetCallback(asset.token.address, asset);

    const quoteRequest: QuoteGetRequest = {
      inputMint: asset.token.address,
      outputMint: outputMint,
      amount: Number(asset.balance), // Casting this to number can discard precision...
      slippageBps: 1500
    };

    console.log(`quote request`, quoteRequest);

    try {
      const quote = await quoteApi.quoteGet(quoteRequest);
      foundQuoteCallback(asset.token.address, quote);

      const rq: SwapPostRequest = {
        swapRequest: {
          userPublicKey: walletAddress,
          quoteResponse: quote
        }
      };

      try {
        const swap = await quoteApi.swapInstructionsPost(rq);
        foundSwapCallback(asset.token.address, swap);
      } catch (swapErr) {
        console.log(`Failed to get swap for ${asset.token.symbol}`);
        console.log(swapErr);
        errorCallback(asset.token.address, "Couldn't get swap transaction");
      }
    } catch (quoteErr) {
      console.log(`Failed to get quote for ${asset.token.symbol}`);
      console.log(quoteErr);
      errorCallback(asset.token.address, "Couldn't get quote");
    }

    // fetchUsd price
    try {
      const balanceNoDecimals = Number(asset.balance) / Math.pow(10, asset.token.decimals);
      const usdPrice = await fetchUsdPrice(asset.token.address, Number(balanceNoDecimals)) || 0;
      foundUsdCallback(asset.token.address, usdPrice);
    } catch (usdErr) {
      console.log(`Failed to get usd price for ${asset.token.symbol}`);
      console.log(usdErr);
      errorCallback(asset.token.address, "Couldn't get usd price");
    }
  }

  // );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load Jupyter API and tokens
 *
 * @returns [instance of Jupiter API, map of known token types by mint address]
 */
async function loadJupyterApi(): Promise<
  [DefaultApi, { [id: string]: TokenInfo }]
> {
  // https://public.jupiterapi.com
  const ENDPOINT = "https://jupiter-swap-api.quiknode.pro/295A45DF282E";
  const CONFIG = {
    basePath: ENDPOINT,
  };

  let quoteApi = createJupiterApiClient(CONFIG);
  const allTokens = await fetch('https://token.jup.ag/all');
  const allList = await allTokens.json();
  const tokenMap: { [id: string]: TokenInfo } = {};
  allList.forEach((token: TokenInfo) => {
    tokenMap[token.address] = token;
  });

  const strictTokens = await fetch('https://token.jup.ag/strict');
  const strictList = await strictTokens.json();
  strictList.forEach((token: TokenInfo) => {
    tokenMap[token.address].strict = true;
  });
  return [quoteApi, tokenMap];
}

export { getTokenAccounts, getAssetBurnReturn, sweepTokens, findQuotes, loadJupyterApi, getTotalFee, BONK_TOKEN_MINT };
export type { TokenInfo, TokenBalance };
