import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import React, { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  sweepTokens,
  findQuotes,
  TokenInfo,
  TokenBalance,
  loadJupyterApi,
} from "./scooper";
import {
  DefaultApi,
  SwapInstructionsResponse,
  QuoteResponse,
} from "@jup-ag/api";

enum ApplicationStates {
  LOADING = 0,
  LOADED_JUPYTER = 1,
  LOADED_QUOTES = 2,
  SCOOPING = 3,
  SCOOPED = 4,
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

const forbiddenTokens = ["Bonk", "USDC", "USDT"];

const AssetList: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [assetList, setAssetList] = React.useState<{
    [id: string]: AssetState;
  }>({});
  const [walletAddress, setWalletAddress] = React.useState("");
  const [tokens, setTokens] = React.useState<{ [id: string]: TokenInfo }>({});
  const [state, setState] = React.useState<ApplicationStates>(
    ApplicationStates.LOADING
  );
  const [selectAll, setSelectAll] = useState(false);
  const handleSelectAll = () => {
    setSelectAll(!selectAll);

    const updatedAssetListObject = Object.fromEntries(
      Object.entries(assetList).map(([key, asset]) => [
        key,
        {
          ...asset,
          checked: !selectAll,
        },
      ])
    );
    setAssetList(updatedAssetListObject);
  };

  function updateAssetList(
    updater: (arg: { [id: string]: AssetState }) => { [id: string]: AssetState }
  ) {
    setAssetList((aL) => {
      console.log("Old state:");
      console.log(assetList);
      let newState = updater({ ...aL });
      console.log("New state:");
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
        "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
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

  console.log("assetlist", assetList);

  const steps = [
    {
      title: "Lorem, ipsum dolor.",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Error cumque tempore est ab possimus quisquam reiciendis tempora animi! Quaerat, saepe?",
    },
    {
      title: "Lorem, ipsum dolor.",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Error cumque tempore est ab possimus quisquam reiciendis tempora animi! Quaerat, saepe?",
    },
    {
      title: "Lorem, ipsum dolor.",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Error cumque tempore est ab possimus quisquam reiciendis tempora animi! Quaerat, saepe?",
    },
    {
      title: "Lorem, ipsum dolor.",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Error cumque tempore est ab possimus quisquam reiciendis tempora animi! Quaerat, saepe?",
    },
    {
      title: "Lorem, ipsum dolor.",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Error cumque tempore est ab possimus quisquam reiciendis tempora animi! Quaerat, saepe?",
    },
    {
      title: "Lorem, ipsum dolor.",
      description:
        "Lorem ipsum dolor sit amet consectetur adipisicing elit. Error cumque tempore est ab possimus quisquam reiciendis tempora animi! Quaerat, saepe?",
    },
  ];

  const ScoopList = () => {
    return (
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <div className="overflow-x-auto rounded-3xl">
          <table className="min-w-full divide-y-2 divide-gray-200 bg-white text-sm rounded-3xl">
            <thead className="ltr:text-left rtl:text-right">
              <tr>
                <th className="sticky inset-y-0 start-0 bg-white p-4">
                  <label className="sr-only">Select All</label>

                  <input
                    type="checkbox"
                    id="SelectAll"
                    checked={selectAll}
                    className="h-4 w-4 rounded border-gray-300"
                    onClick={() => handleSelectAll()}
                    disabled={state !== ApplicationStates.LOADED_QUOTES}
                  />
                </th>
                <th className="whitespace-nowrap p-4 font-medium text-gray-900 text-lg text-left">
                  Symbol
                </th>
                <th className="whitespace-nowrap p-4 font-medium text-gray-900 text-lg text-right">
                  Balance
                </th>
                <th className="whitespace-nowrap p-4 font-medium text-gray-900 text-lg text-right">
                  Scoop Value
                </th>
                <th className="whitespace-nowrap p-4 font-medium text-gray-900 text-lg text-right">
                  Strict
                </th>
                {/* <th className="whitespace-nowrap p-4 font-medium text-gray-900 text-lg">
                    Status
                  </th> */}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {Object.entries(assetList).map(([key, entry]) => {
                console.log("ENTRY HERE", entry);
                return (
                  <tr
                    key={key}
                    className={`group !border-l-8 ${
                      entry.checked
                        ? "!border-l-8 !border-l-bonk-yellow bg-gray-100"
                        : "hover:bg-gray-100 hover:!border-l-bonk-yellow !border-l-white"
                    }`}
                  >
                    <td
                      className={`p-4 bg-white group-hover:bg-gray-100 text-center ${
                        entry.checked ? "!bg-gray-100" : ""
                      }`}
                    >
                      {forbiddenTokens.includes(entry.asset.token.symbol) || (
                        <input
                          className="h-4 w-4 rounded border-gray-300"
                          checked={entry.checked}
                          onChange={(change) => {
                            updateAssetList((aL) => {
                              aL[entry.asset?.token.address].checked =
                                change.target.checked;
                              return aL;
                            });
                          }}
                          type="checkbox"
                          disabled={state !== ApplicationStates.LOADED_QUOTES}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap p-4 text-gray-700 text-left">
                      <a
                        className="flex gap-4 items-center hover:font-bold"
                        href={`https://birdeye.so/token/${entry.asset.token.address}?chain=solana`}
                        target="_blank"
                      >
                        {entry.asset.token.logoURI ? (
                          <img
                            src={entry.asset.token.logoURI}
                            alt={`${entry.asset.token.symbol} Logo`}
                            className="h-8 w-8 rounded-full border border-[#091e05]"
                          />
                        ) : (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 rounded-full border border-[#091e05]"
                          >
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M17 5V4C17 2.89543 16.1046 2 15 2H9C7.89543 2 7 2.89543 7 4V5H4C3.44772 5 3 5.44772 3 6C3 6.55228 3.44772 7 4 7H5V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H17ZM15 4H9V5H15V4ZM17 7H7V18C7 18.5523 7.44772 19 8 19H16C16.5523 19 17 18.5523 17 18V7Z"
                              fill="currentColor"
                            />
                            <path d="M9 9H11V17H9V9Z" fill="currentColor" />
                            <path d="M13 9H15V17H13V9Z" fill="currentColor" />
                          </svg>
                        )}
                        <p>{entry.asset.token.symbol}</p>
                      </a>
                    </td>
                    <td className="whitespace-nowrap p-4 text-gray-700 text-right font-mono">
                      {(
                        Number(entry.asset?.balance) /
                        10 ** entry.asset.token.decimals
                      ).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap p-4 text-gray-700 text-right font-mono">
                      {entry.quote?.outAmount
                        ? (
                            Number(entry.quote.outAmount) /
                            10 ** 5
                          ).toLocaleString()
                        : "No quote"}
                    </td>
                    <td className="whitespace-nowrap p-4 text-gray-700 text-right">
                      {entry.asset?.token.strict && <p>Strict</p>}
                    </td>
                    <td className="whitespace-nowrap p-4 text-gray-700 text-right">
                      {entry.transactionState && (
                        <p>{entry.transactionState}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="top-12 mb-auto flex flex-col gap-4 lg:sticky bg-white rounded-3xl p-4 order-first lg:order-last">
          <article className="flex items-center gap-4 rounded-lg border border-gray-300 bg-white p-6 sm:justify-between">
            <span className="rounded-full bg-bonk-yellow/20 p-3 text-bonk-yellow sm:order-last">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M17 5V4C17 2.89543 16.1046 2 15 2H9C7.89543 2 7 2.89543 7 4V5H4C3.44772 5 3 5.44772 3 6C3 6.55228 3.44772 7 4 7H5V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H17ZM15 4H9V5H15V4ZM17 7H7V18C7 18.5523 7.44772 19 8 19H16C16.5523 19 17 18.5523 17 18V7Z"
                  fill="currentColor"
                />
                <path d="M9 9H11V17H9V9Z" fill="currentColor" />
                <path d="M13 9H15V17H13V9Z" fill="currentColor" />
              </svg>
            </span>

            <div>
              <p className="text-2xl font-medium text-gray-900">
                {(totalPossibleScoop / 10 ** 5).toLocaleString()}
              </p>

              <p className="text-sm text-gray-500">Possible Scoop</p>
            </div>
          </article>
          <article className="flex items-center gap-4 rounded-lg border border-gray-300 bg-white p-6 sm:justify-between">
            <span className="rounded-full bg-bonk-yellow/20 p-3 text-bonk-yellow sm:order-last">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M22.775 8C22.9242 8.65461 23 9.32542 23 10H14V1C14.6746 1 15.3454 1.07584 16 1.22504C16.4923 1.33724 16.9754 1.49094 17.4442 1.68508C18.5361 2.13738 19.5282 2.80031 20.364 3.63604C21.1997 4.47177 21.8626 5.46392 22.3149 6.55585C22.5091 7.02455 22.6628 7.5077 22.775 8ZM20.7082 8C20.6397 7.77018 20.5593 7.54361 20.4672 7.32122C20.1154 6.47194 19.5998 5.70026 18.9497 5.05025C18.2997 4.40024 17.5281 3.88463 16.6788 3.53284C16.4564 3.44073 16.2298 3.36031 16 3.2918V8H20.7082Z"
                  fill="currentColor"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M1 14C1 9.02944 5.02944 5 10 5C10.6746 5 11.3454 5.07584 12 5.22504V12H18.775C18.9242 12.6546 19 13.3254 19 14C19 18.9706 14.9706 23 10 23C5.02944 23 1 18.9706 1 14ZM16.8035 14H10V7.19648C6.24252 7.19648 3.19648 10.2425 3.19648 14C3.19648 17.7575 6.24252 20.8035 10 20.8035C13.7575 20.8035 16.8035 17.7575 16.8035 14Z"
                  fill="currentColor"
                />
              </svg>
            </span>

            <div>
              <p className="text-2xl font-medium text-gray-900">
                {(totalScoop / 10 ** 5).toLocaleString()}
              </p>

              <p className="text-sm text-gray-500">Total Scoop</p>
            </div>
          </article>
          {state === ApplicationStates.LOADED_QUOTES && (
            <button
              className="inline-block rounded bg-bonk-yellow px-8 py-3 font-medium text-black transition hover:shadow-xl focus:outline-none focus:ring active:bg-indigo-500 text-xl"
              onClick={scoop}
            >
              Scoop
            </button>
          )}
        </div>
      </div>
    );
  };
  return (
    <>
      {" "}
      <div className="flex flex-col gap-4">
        <section className="bg-[#004f2d] text-white rounded-3xl relative px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <div className="block md:absolute !top-12 !right-12 pb-4">
            <WalletMultiButton />
          </div>
          <div className="max-w-screen-xl">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold sm:text-4xl">Doodie Bag</h2>

              <p className="mt-4 text-gray-300">
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Repellat dolores iure fugit totam iste obcaecati. Consequatur
                ipsa quod ipsum sequi culpa delectus, cumque id tenetur
                quibusdam, quos fuga minima.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 md:gap-12 lg:grid-cols-3">
              {steps.map((step, index) => {
                const { title, description } = step;
                return (
                  <div className="flex items-start gap-4">
                    <span className="shrink-0 rounded-lg bg-[#091e05] p-4 text-center">
                      <p className="h-5 w-5">{index + 1}</p>
                    </span>

                    <div>
                      <h2 className="text-lg font-bold">{title}</h2>

                      <p className="mt-1 text-sm text-gray-300">
                        {description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        {wallet && connection && wallet.publicKey ? (
          <ScoopList />
        ) : (
          <div className="text-white">Please connect your wallet</div>
        )}
      </div>
    </>
  );
};

export default AssetList;
