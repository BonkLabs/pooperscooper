import React, { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  sweepTokens,
  findQuotes,
  TokenInfo,
  TokenBalance,
  loadJupyterApi,
} from "../scooper";
import {
  DefaultApi,
  SwapInstructionsResponse,
  QuoteResponse,
} from "@jup-ag/api";

const BONK_TOKEN_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

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
  const [openModal, setOpenModal] = useState(false);
  const [search, setSearch] = useState("");

  // Filters
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [showStrict, setShowStrict] = useState(false);

  // Sort
  const [sortOption, setSortOption] = useState("");
  const [ascending, setAscending] = useState(true);

  const isButtonDisabled = !Object.values(assetList).some(
    (entry) => entry.checked
  );

  const selectedItems = Object.values(assetList).filter(
    (entry) => entry.checked
  );

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

  function reload() {
    setAssetList((al) => {
      const newList: { [id: string]: AssetState } = {};
      Object.entries(newList).forEach(([key, asset]) => {
        newList[key] = new AssetState(asset.asset);
      });
      return newList;
    });
    setState(ApplicationStates.LOADING);
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
        BONK_TOKEN_MINT,
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
  }, [walletAddress, jupiterQuoteApi, tokens, state]);
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
      )
        .then(() => {
          setState(ApplicationStates.SCOOPED);
        })
        .catch((err) => {
          // TODO: @godzid - should we trigger an error banner here?
          //                  this case only triggers when signing fails
          console.log("Error signing for scoop!" + err);
          setState(ApplicationStates.LOADED_QUOTES);
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

  const filteredData = Object.entries(assetList).filter((entry) => {
    const nameSearch = entry[1].asset.token.symbol
      .toLowerCase()
      .includes(search.toLowerCase());
    const filterZeroBalance =
      !showZeroBalance ||
      Number(entry[1].asset?.balance) / 10 ** entry[1].asset.token.decimals ===
        0;
    const filterStrict = !showStrict || entry[1].asset.token.strict === true;

    return nameSearch && filterZeroBalance && filterStrict;
  });

  const sortedAssets = [...filteredData].sort((a, b) => {
    let comparison = 0;

    switch (sortOption) {
      case "symbol":
        comparison = a[1].asset.token.symbol.localeCompare(
          b[1].asset.token.symbol
        );
        break;
      case "balance":
        comparison =
          Number(a[1].asset.balance) / 10 ** a[1].asset.token.decimals -
          Number(b[1].asset.balance) / 10 ** b[1].asset.token.decimals;
        break;
      case "scoopValue":
        comparison =
          (Number(a[1].quote?.outAmount) ?? 0) -
          (Number(b[1].quote?.outAmount) ?? 0);
        break;
      default:
        break;
    }

    return ascending === true ? comparison : -comparison; // Adjust comparison based on sortOrder
  });

  console.log("FILTERED DATA HERE", filteredData);

  const SummaryModal = () => {
    return (
      <div
        className={`fixed inset-0 z-30 flex h-full w-full flex-col gap-4 bg-black bg-opacity-75 transition-all duration-1000 items-center justify-center ${
          openModal ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div
          className="relative grid md:grid-cols-[2fr_1fr] w-screen max-w-5xl border border-gray-600 bg-gray-100 px-4 py-8 sm:px-6 lg:px-8 rounded max-h-[80vh] gap-8"
          role="dialog"
        >
          <button
            className="absolute end-4 top-4 text-gray-600 transition hover:scale-110"
            onClick={() => setOpenModal(false)}
          >
            <span className="sr-only">Close cart</span>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="mt-4 space-y-6 overflow-hidden overflow-y-auto pr-8">
            <ul className="space-y-4">
              {selectedItems.map((entry, index) => {
                return (
                  <li className="flex items-center gap-4">
                    <img
                      src={entry.asset.token.logoURI}
                      alt="Logo"
                      className="h-16 w-16 rounded object-cover"
                    />

                    <div>
                      <h3 className="text-sm text-gray-900">
                        {entry.asset.token.name}
                      </h3>

                      <dl className="mt-0.5 space-y-px text-[10px] text-gray-600">
                        <div>
                          <dt className="inline">Balance: </dt>
                          <dd className="inline">
                            {(
                              Number(entry.asset?.balance) /
                              10 ** entry.asset.token.decimals
                            ).toLocaleString()}
                          </dd>
                        </div>

                        <div>
                          <dt className="inline">Scoop Value: </dt>
                          <dd className="inline">
                            {entry.quote?.outAmount
                              ? (
                                  Number(entry.quote.outAmount) /
                                  10 ** 5
                                ).toLocaleString()
                              : "No quote"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-2">
                      {state === ApplicationStates.LOADED_QUOTES ? (
                        <button
                          className="text-gray-600 transition hover:text-red-600"
                          onClick={() => {
                            updateAssetList((aL) => {
                              aL[entry.asset?.token.address].checked = false;
                              if (selectedItems.length === 1) {
                                setOpenModal(false);
                              }
                              return aL;
                            });
                          }}
                        >
                          <span className="sr-only">Remove item</span>

                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8 11C7.44772 11 7 11.4477 7 12C7 12.5523 7.44772 13 8 13H16C16.5523 13 17 12.5523 17 12C17 11.4477 16.5523 11 16 11H8Z"
                              fill="currentColor"
                            />
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      ) : state === ApplicationStates.SCOOPING ? (
                        // Loading
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="animate-spin"
                        >
                          <path
                            opacity="0.2"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                            fill="currentColor"
                          />
                          <path
                            d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z"
                            fill="currentColor"
                          />
                        </svg>
                      ) : entry.transactionState === "Scooped" ? (
                        // Checkmark
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M10.2426 16.3137L6 12.071L7.41421 10.6568L10.2426 13.4853L15.8995 7.8284L17.3137 9.24262L10.2426 16.3137Z"
                            fill="currentColor"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M1 5C1 2.79086 2.79086 1 5 1H19C21.2091 1 23 2.79086 23 5V19C23 21.2091 21.2091 23 19 23H5C2.79086 23 1 21.2091 1 19V5ZM5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z"
                            fill="currentColor"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M16.3956 7.75734C16.7862 8.14786 16.7862 8.78103 16.3956 9.17155L13.4142 12.153L16.0896 14.8284C16.4802 15.2189 16.4802 15.8521 16.0896 16.2426C15.6991 16.6331 15.0659 16.6331 14.6754 16.2426L12 13.5672L9.32458 16.2426C8.93405 16.6331 8.30089 16.6331 7.91036 16.2426C7.51984 15.8521 7.51984 15.2189 7.91036 14.8284L10.5858 12.153L7.60436 9.17155C7.21383 8.78103 7.21383 8.14786 7.60436 7.75734C7.99488 7.36681 8.62805 7.36681 9.01857 7.75734L12 10.7388L14.9814 7.75734C15.372 7.36681 16.0051 7.36681 16.3956 7.75734Z"
                            fill="currentColor"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M4 1C2.34315 1 1 2.34315 1 4V20C1 21.6569 2.34315 23 4 23H20C21.6569 23 23 21.6569 23 20V4C23 2.34315 21.6569 1 20 1H4ZM20 3H4C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V4C21 3.44772 20.5523 3 20 3Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-4 mt-4">
            <div className="border-t border-gray-100">
              <div className="space-y-4">
                <dl className="space-y-0.5 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <dt>No. of Scooped Tokens</dt>
                    <dd>{selectedItems.length}</dd>
                  </div>

                  <div className="flex justify-between">
                    <dt>Total Expected Scoop Value</dt>
                    <dd>{(totalScoop / 10 ** 5).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <button
              onClick={scoop}
              className="block rounded bg-bonk-yellow px-5 py-3 text-sm text-gray-700 transition hover:bg-bonk-yellow/80 w-full"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ScoopList = () => {
    return (
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <div className={`overflow-x-auto rounded-3xl self-start`}>
          <table className="min-w-full divide-y-2 divide-gray-200 bg-white text-sm">
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
            <tbody className="divide-y divide-gray-200 relative">
              {state !== ApplicationStates.LOADED_QUOTES && (
                <tr>
                  <td className="table-cell" colSpan={5}>
                    <div className="text-center font-black uppercase text-lg lg:text-4xl bg-white/70 flex items-center gap-2 min-h-48 h-full w-full justify-center animate-pulse">
                      Fetching Data...{" "}
                      <svg
                        width="72"
                        height="72"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="animate-spin w-12 h-12 lg:w-auto lg:h-auto"
                      >
                        <path
                          opacity="0.2"
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                          fill="currentColor"
                        />
                        <path
                          d="M12 22C17.5228 22 22 17.5228 22 12H19C19 15.866 15.866 19 12 19V22Z"
                          fill="currentColor"
                        />
                        <path
                          d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </td>
                </tr>
              )}
              {state === ApplicationStates.LOADED_QUOTES &&
                filteredData.length === 0 && (
                  <tr>
                    <td className="table-cell" colSpan={5}>
                      <div className="text-center font-black uppercase text-lg lg:text-4xl bg-white/70 flex items-center gap-2 min-h-48 h-full w-full justify-center">
                        No Data
                      </div>
                    </td>
                  </tr>
                )}
              {sortedAssets.map(([key, entry]) => {
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
        <div className="lg:sticky order-first lg:order-last top-12 mb-auto grid gap-4">
          <div className="flex flex-col gap-4 bg-white rounded-3xl p-4">
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
            <button
              className={`inline-block rounded bg-bonk-yellow px-8 py-3 font-medium text-black transition focus:outline-none focus:ring text-xl ${
                isButtonDisabled
                  ? "hover:cursor-not-allowed opacity-50"
                  : "hover:shadow-xl"
              }`}
              disabled={isButtonDisabled}
              onClick={() => setOpenModal(true)}
            >
              Scoop
            </button>
          </div>
          <div
            className={`grid gap-2 bg-white rounded-3xl p-4 ${
              state !== ApplicationStates.LOADED_QUOTES
                ? "hover:cursor-not-allowed"
                : ""
            }`}
          >
            <div
              className={`relative ${
                state !== ApplicationStates.LOADED_QUOTES
                  ? "pointer-events-none"
                  : ""
              }`}
            >
              <label className="sr-only"> Search </label>

              <input
                type="text"
                placeholder="Search Asset"
                className="w-full rounded border border-gray-300 py-2.5 px-4 pe-10 shadow-sm sm:text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <span className="absolute inset-y-0 end-0 grid w-10 place-content-center">
                <button
                  type="button"
                  className="text-gray-600 hover:text-gray-700"
                >
                  <span className="sr-only">Search</span>

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </button>
              </span>
            </div>
            <div
              className={`space-y-2 ${
                state !== ApplicationStates.LOADED_QUOTES
                  ? "pointer-events-none"
                  : ""
              }`}
            >
              <details className="overflow-hidden rounded border border-gray-300 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-2 bg-white p-4 text-gray-900 transition">
                  <span className="text-sm font-medium"> Filter </span>

                  <span className="transition group-open:-rotate-180">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </span>
                </summary>

                <div className="border-t border-gray-200 bg-white">
                  <ul className="space-y-1 border-t border-gray-200 p-4">
                    <li>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-gray-300"
                          onClick={() => setShowZeroBalance(!showZeroBalance)}
                        />

                        <span className="text-sm font-medium text-gray-700">
                          0 Balance
                        </span>
                      </label>
                    </li>

                    <li>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-gray-300"
                          onClick={() => setShowStrict(!showStrict)}
                        />

                        <span className="text-sm font-medium text-gray-700">
                          Strict
                        </span>
                      </label>
                    </li>
                  </ul>
                </div>
              </details>

              <details className="overflow-hidden rounded border border-gray-300 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-2 bg-white p-4 text-gray-900 transition">
                  <span className="text-sm font-medium"> Sort </span>

                  <span className="transition group-open:-rotate-180">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </span>
                </summary>

                <div className="border-t border-gray-200 bg-white">
                  <header className="flex items-center justify-between p-4">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      Ascending
                      <label className="relative h-8 w-12 cursor-pointer [-webkit-tap-highlight-color:_transparent]">
                        <input
                          type="checkbox"
                          id="AcceptConditions"
                          className="peer sr-only"
                          // value={ascending}
                          onClick={() => setAscending(!ascending)}
                        />

                        <span className="absolute inset-0 m-auto h-2 rounded-full bg-gray-300"></span>

                        <span className="absolute inset-y-0 start-0 m-auto h-6 w-6 rounded-full bg-gray-500 transition-all peer-checked:start-6 peer-checked:[&_>_*]:scale-0">
                          <span className="absolute inset-0 m-auto h-4 w-4 rounded-full bg-gray-200 transition">
                            {" "}
                          </span>
                        </span>
                      </label>
                      Descending
                    </span>
                  </header>

                  <ul className="space-y-1 border-t border-gray-200 p-4">
                    <li>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="sort"
                          value="symbol"
                          onClick={(e) => setSortOption("symbol")}
                          className="h-5 w-5 rounded border-gray-300"
                        />

                        <span className="text-sm font-medium text-gray-700">
                          Symbol
                        </span>
                      </label>
                    </li>

                    <li>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="sort"
                          value="balance"
                          onClick={(e) => setSortOption("balance")}
                          className="h-5 w-5 rounded border-gray-300"
                        />

                        <span className="text-sm font-medium text-gray-700">
                          Balance
                        </span>
                      </label>
                    </li>

                    <li>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="sort"
                          value="scoopValue"
                          onClick={(e) => setSortOption("scoopValue")}
                          className="h-5 w-5 rounded border-gray-300"
                        />

                        <span className="text-sm font-medium text-gray-700">
                          Scoop Value
                        </span>
                      </label>
                    </li>
                  </ul>
                </div>
              </details>
            </div>
            <div
              className={`flex justify-end w-full ${
                state !== ApplicationStates.LOADED_QUOTES
                  ? "pointer-events-none"
                  : ""
              }`}
            >
              <div
                className="bg-[#FF5C01] text-white text-center py-2 rounded hover:opacity-65 hover:cursor-pointer max-w-max px-8 flex items-center gap-2"
                onClick={(x) => {
                  reload();
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13.1459 11.0499L12.9716 9.05752L15.3462 8.84977C14.4471 7.98322 13.2242 7.4503 11.8769 7.4503C9.11547 7.4503 6.87689 9.68888 6.87689 12.4503C6.87689 15.2117 9.11547 17.4503 11.8769 17.4503C13.6977 17.4503 15.2911 16.4771 16.1654 15.0224L18.1682 15.5231C17.0301 17.8487 14.6405 19.4503 11.8769 19.4503C8.0109 19.4503 4.87689 16.3163 4.87689 12.4503C4.87689 8.58431 8.0109 5.4503 11.8769 5.4503C13.8233 5.4503 15.5842 6.24474 16.853 7.52706L16.6078 4.72412L18.6002 4.5498L19.1231 10.527L13.1459 11.0499Z"
                    fill="currentColor"
                  />
                </svg>
                Refresh Assets
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {" "}
      <div className="flex flex-col gap-4 z-30 relative">
        <SummaryModal />
        {ScoopList()}
      </div>
    </>
  );
};

export default AssetList;
