import React from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  sweepTokens,
  findQuotes,
  TokenInfo,
  TokenBalance,
  loadJupyterApi
} from './scooper';
import {
  DefaultApi,
  SwapInstructionsResponse,
  QuoteResponse
} from '@jup-ag/api';

enum ApplicationStates {
  LOADING = 0,
  LOADED_JUPYTER = 1,
  LOADED_QUOTES = 2,
  SCOOPING = 3,
  SCOOPED = 4
}

class AssetState {
  asset: TokenBalance;
  quote?: QuoteResponse;
  swap?: SwapInstructionsResponse;
  checked?: boolean;
  transactionState?: string;
  transactionId?: string;

  constructor(
    assetArg: any,
    quoteArg?: QuoteResponse,
    swapArg?: SwapInstructionsResponse,
    checkedArg?: boolean,
    transactionStateArg?: string,
    transactionIdArg?: string
  ) {
    this.asset = assetArg;
    this.quote = quoteArg;
    this.swap = swapArg;
    this.checked = checkedArg;
    this.transactionState = transactionStateArg;
    this.transactionId = transactionIdArg;
  }
}

const forbiddenTokens = ["Bonk"]

const AssetList: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [assetList, setAssetList] = React.useState<{
    [id: string]: AssetState;
  }>({});
  const [walletAddress, setWalletAddress] = React.useState('');
  const [tokens, setTokens] = React.useState<{ [id: string]: TokenInfo }>({});
  const [state, setState] = React.useState<ApplicationStates>(
    ApplicationStates.LOADING
  );

  function updateAssetList(
    updater: (arg: { [id: string]: AssetState }) => { [id: string]: AssetState }
  ) {
    setAssetList((aL) => {
      console.log('Old state:');
      console.log(assetList);
      let newState = updater({ ...aL });
      console.log('New state:');
      console.log(newState);
      return newState;
    });
  }

  /* Application startup */
  /* 1.a: Load the wallet address */
  if (wallet.connected && wallet.publicKey && connection) {
    if (walletAddress != wallet.publicKey.toString()) {
      setWalletAddress(wallet.publicKey.toString());
    }
  }

  /* 1.b: Load the Jupiter Quote API */
  const [jupiterQuoteApi, setQuoteApi] = React.useState<DefaultApi | null>();
  React.useEffect(() => {
    loadJupyterApi().then(([quoteApi, tokenMap]) => {
      setTokens(tokenMap);
      setQuoteApi(quoteApi);
    });
  }, []);

  /* 2: Load information about users tokens, add any tokens to list */
  React.useEffect(() => {
    // Run only once
    if (
      walletAddress &&
      jupiterQuoteApi &&
      tokens &&
      state == ApplicationStates.LOADING
    ) {
      setState(ApplicationStates.LOADED_JUPYTER);
      setAssetList({});
      findQuotes(
        connection,
        tokens,
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        walletAddress,
        jupiterQuoteApi,
        (id, asset) => {
          updateAssetList((s) => ({ ...s, [id]: new AssetState(asset) }));
        },
        (id, quote) => {
          updateAssetList((aL) => {
            aL[id].quote = quote;
            return aL;
          });
        },
        (id, swap) => {
          updateAssetList((aL) => {
            aL[id].swap = swap;
            return aL;
          });
        },
        (id, error) => {}
      ).then(() => {
        setState(ApplicationStates.LOADED_QUOTES);
      });
    }
  }, [walletAddress, jupiterQuoteApi, tokens]);
  /* End application startup */

  /* Scoop button callback, clean all the tokens! */
  const scoop = () => {
    // Run only once
    if (state == ApplicationStates.LOADED_QUOTES) {
      setState(ApplicationStates.SCOOPING);
      sweepTokens(
        wallet,
        connection,
        Object.values(assetList),
        (id: string, state: string) => {
          updateAssetList((aL) => {
            assetList[id].transactionState = state;
            return aL;
          });
        },
        (id, txid) => {},
        (id, error) => {}
      ).then(() => {
        setState(ApplicationStates.SCOOPED);
      });
    }
  };

  /* Maintain counters of the total possible yield and yield from selected swaps */
  var totalPossibleScoop = 0;
  var totalScoop = 0;

  Object.entries(assetList).forEach(([key, asset]) => {
    if (asset.quote) {
      if (asset.checked) {
        totalScoop += Number(asset.quote.outAmount);
      }
      totalPossibleScoop += Number(asset.quote.outAmount);
    }
  });

  if (!jupiterQuoteApi || !walletAddress) {
    return <></>;
  }
  return (
    <>
      {' '}
      <div>
        <div
          className="NormalText"
          style={{
            position: 'absolute',
            top: '320px',
            left: '10vw',
            width: '80vw',
            justifyContent: 'center',
            bottom: '5vh'
          }}
        >
          <table style={{ height: '70%', width: '80vw' }}>
            <tbody>
              <tr>
                <th>Symbol</th>
                <th>Balance</th>
                <th>Scoop Value</th>
                <th>Strict</th>
                <th>Scoop?</th>
                <th>Status</th>
              </tr>
              {Object.entries(assetList).map(([key, entry]) => (
                <tr key={entry.asset.token.address}>
                  <td>{entry.asset.token.symbol}</td>
                  <td>
                    {Number(entry.asset?.balance) /
                      10 ** entry.asset.token.decimals}
                  </td>
                  <td>
                    {Number(entry.quote?.outAmount) / 10 ** 5 || 'No quote'}
                  </td>
                  <td>{entry.asset?.token.strict && <p>Strict</p>}</td>
                  <td>
                    { forbiddenTokens.includes(entry.asset.token.symbol) ||
                      <input
                        onChange={(change) => {
                          updateAssetList((aL) => {
                            aL[entry.asset?.token.address].checked =
                              change.target.checked;
                            return aL;
                          });
                        }}
                        type="checkbox"
                        disabled={state != ApplicationStates.LOADED_QUOTES}
                      />
                    }
                  </td>
                  <td>
                    {entry.transactionState && <p>{entry.transactionState}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <div>
              <label>Possible Scoop:</label>
              <label>{totalPossibleScoop / 10 ** 5}</label>
            </div>
            <div>
              <label>Total Scoop:</label>
              <label>{totalScoop / 10 ** 5}</label>
            </div>

            {state == ApplicationStates.LOADED_QUOTES && (
              <button className="NormalText" onClick={scoop}>
                Scoop
              </button>
            )}
          </div>
        </div>
        <div
          className="InfoText"
          style={{
            position: 'absolute',
            top: '5px',
            height: '280px',
            left: '55vw',
            width: '40vw',
            justifyContent: 'center'
          }}
        >
          <pre>Pressing scoop performs the following actions:</pre>
          <pre>    For each checked token:</pre>
          <pre>        If there is a swap quote for the token, swap the token for bonk</pre>
          <pre>        If there is anything left in the account, burn it</pre>
          <pre>        If the token has withheld transfer fees, pay them</pre>
          <pre>        Now that the account is empty, close it</pre>
          <pre>A single transaction is created for each asset to be scooped.</pre>
          <pre>All transactions are signed with a single wallet signature.</pre>
          <pre>
            <b>Assets burnt through this platform are not recoverable </b>
          </pre>
        </div>
      </div>
    </>
  );
};

export default AssetList;
