import React, { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { sweepTokens, findQuotes, TokenInfo, TokenBalance, loadJupyterApi, BONK_TOKEN_MINT, getAssetBurnReturn } from "../scooper";
import { DefaultApi, SwapInstructionsResponse, QuoteResponse } from "@jup-ag/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { burn } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { track } from "@vercel/analytics";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

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
	usdPrice?: number;
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
	const [state, setState] = React.useState<ApplicationStates>(ApplicationStates.LOADING);
	const [selectAll, setSelectAll] = useState(false);
	const [openModal, setOpenModal] = useState(false);
	const [search, setSearch] = useState("");

	// Filters
	const [showZeroBalance, setShowZeroBalance] = useState(false);
	const [showStrict, setShowStrict] = useState(false);

	// Sort
	const [sortOption, setSortOption] = useState("");
	const [ascending, setAscending] = useState(true);

	const isButtonDisabled = !Object.values(assetList).some((entry) => entry.checked);

	const selectedItems = Object.values(assetList).filter((entry) => entry.checked);

	const handleSelectAll = () => {
		setSelectAll(!selectAll);

		const updatedAssetListObject = Object.fromEntries(
			Object.entries(assetList).map(([key, asset]) => [
				key,
				{
					...asset,
					checked: !selectAll && filteredData.some((entry) => entry[0] === key) && !cannotScoop(asset), // updated: only selects "all" from currently filtered data
				},
			])
		);

		setAssetList(updatedAssetListObject);
	};

	function updateAssetList(updater: (arg: { [id: string]: AssetState }) => { [id: string]: AssetState }) {
		setAssetList((aL) => {
			let newState = updater({ ...aL });
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
		if (walletAddress && jupiterQuoteApi && tokens && state == ApplicationStates.LOADING) {
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
				(id, usdPrice) => {
					updateAssetList((aL) => {
						aL[id].usdPrice = usdPrice;
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
					track("Scooped");
				})
				.catch((err) => {
					const notify = () => toast.error("User rejected transaction!");
					notify();
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
		const nameSearch = entry[1].asset.token.symbol.toLowerCase().includes(search.toLowerCase());
		const filterZeroBalance = !showZeroBalance || Number((Number(entry[1].asset?.balance) / 10 ** entry[1].asset.token.decimals).toLocaleString()) === 0;
		const filterStrict = !showStrict || entry[1].asset.token.strict === true;

		return nameSearch && filterZeroBalance && filterStrict;
	});

	const cannotScoop = (entry: any) => {
		return entry.asset.balance > 0 && !entry.swap && entry.usdPrice > 1;
	};

	const sortedAssets = [...filteredData].sort((a, b) => {
		let comparison = 0;

		switch (sortOption) {
			case "symbol":
				comparison = a[1].asset.token.symbol.localeCompare(b[1].asset.token.symbol);
				break;
			case "balance":
				comparison = Number(a[1].asset.balance) / 10 ** a[1].asset.token.decimals - Number(b[1].asset.balance) / 10 ** b[1].asset.token.decimals;
				break;
			case "scoopValue":
				comparison = ((Number(a[1].quote?.outAmount) ?? 0) || 0) - ((Number(b[1].quote?.outAmount) ?? 0) || 0);
				break;
			default:
				break;
		}

		return ascending === true ? comparison : -comparison; // Adjust comparison based on sortOrder
	});

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
											<h3 className="text-sm text-gray-900">{entry.asset.token.name}</h3>

											<dl className="mt-0.5 space-y-px text-[10px] text-gray-600">
												<div>
													<dt className="inline">Balance: </dt>
													<dd className="inline">
														{(Number(entry.asset?.balance) / 10 ** entry.asset.token.decimals).toLocaleString()}
													</dd>
												</div>

												<div>
													<dt className="inline">Scoop Value: </dt>
													<dd className="inline">
														{entry.quote?.outAmount ? (Number(entry.quote.outAmount) / 10 ** 5).toLocaleString() : "No quote"}
													</dd>
												</div>

												{entry.quote && !entry.swap && (
													<div>
														<dt className="inline">
															<strong>!!! Swap can't be performed, burning instead !!!</strong>
														</dt>
													</div>
												)}
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
													className="text-bonk-green"
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
												// X
												<svg
													width="24"
													height="24"
													viewBox="0 0 24 24"
													fill="none"
													xmlns="http://www.w3.org/2000/svg"
													className="text-bonk-red-400"
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
							disabled={state === ApplicationStates.SCOOPED}
							className={`block rounded bg-bonk-yellow px-5 py-3 text-sm text-gray-700 transition w-full ${
								state === ApplicationStates.SCOOPED ? "hover:cursor-not-allowed" : "hover:bg-bonk-yellow/80"
							}`}
						>
							Confirm
						</button>
						{state === ApplicationStates.SCOOPED && (
							<div className="italic text-sm text-center">Transaction has been processed, please refresh assets</div>
						)}
					</div>
				</div>
			</div>
		);
	};

	const ScoopList = () => {
		return (
			<div className="grid lg:grid-cols-[2fr_1fr] gap-4">
				<div className={`overflow-x-auto rounded-3xl self-start border-[1.5px] border-white`}>
					<table className="min-w-full divide-y-[1.5px] divide-white bg-white/45 text-sm">
						<thead className="ltr:text-left rtl:text-right text-[#423627] text-xs">
							<tr>
								<th colSpan={6}>
									<div className="flex gap-4 p-4 items-center">
										<div
											className={`relative w-1/2 ${
												state !== ApplicationStates.LOADED_QUOTES &&
												state !== ApplicationStates.SCOOPED &&
												state !== ApplicationStates.SCOOPING &&
												"pointer-events-none"
											}`}
										>
											<label className="sr-only"> Search </label>

											<input
												type="text"
												placeholder="Search Asset"
												className="w-full bg-[#FC910366]/40 border-[1.5px] border-white rounded-lg py-2.5 px-4 pe-10 shadow-sm sm:text-sm placeholder:text-[#423627] !font-light"
												value={search}
												onChange={(e) => setSearch(e.target.value)}
											/>

											<span className="absolute inset-y-0 end-0 grid w-10 place-content-center">
												<button
													type="button"
													className="text-[#423627]"
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
											className={`flex gap-4 w-full ${
												state !== ApplicationStates.LOADED_QUOTES &&
												state !== ApplicationStates.SCOOPED &&
												state !== ApplicationStates.SCOOPING &&
												"pointer-events-none"
											}`}
										>
											<Popover>
												<PopoverTrigger className="flex justify-between w-1/3 gap-2 items-center bg-[#FC910366]/40 border-[1.5px] border-white rounded-lg py-2 px-4">
													<span className="text-sm font-medium"> Filter </span>

													<span className="transition group-open:-rotate-180 text-white">
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
												</PopoverTrigger>
												<PopoverContent>
													<div>
														<ul className="space-y-1">
															<li>
																<label className="inline-flex items-center gap-2">
																	<input
																		type="checkbox"
																		className="h-5 w-5 rounded border-gray-300"
																		onClick={() => setShowZeroBalance(!showZeroBalance)}
																	/>

																	<span className="text-sm font-medium text-[#423627]">0 Balance</span>
																</label>
															</li>

															<li>
																<label className="inline-flex items-center gap-2">
																	<input
																		type="checkbox"
																		className="h-5 w-5 rounded border-gray-300"
																		onClick={() => setShowStrict(!showStrict)}
																	/>

																	<span className="text-sm font-medium text-[#423627]">Strict</span>
																</label>
															</li>
														</ul>
													</div>
												</PopoverContent>
											</Popover>

											<Popover>
												<PopoverTrigger className="flex justify-between w-1/3 gap-2 items-center bg-[#FC910366]/40 border-[1.5px] border-white rounded-lg py-2 px-4">
													<span className="text-sm font-medium"> Sort </span>

													<span className="transition group-open:-rotate-180 text-white">
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
												</PopoverTrigger>
												<PopoverContent>
													<div>
														<header className="flex items-center justify-between p-4">
															<span className="text-sm text-[#423627] flex items-center gap-2">
																Ascending
																<label className="relative h-8 w-12 cursor-pointer [-webkit-tap-highlight-color:_transparent]">
																	<input
																		type="checkbox"
																		id="AcceptConditions"
																		className="peer sr-only"
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

																	<span className="text-sm font-medium text-[#423627]">Symbol</span>
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

																	<span className="text-sm font-medium text-[#423627]">Balance</span>
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

																	<span className="text-sm font-medium text-[#423627]">Scoop Value</span>
																</label>
															</li>
														</ul>
													</div>
												</PopoverContent>
											</Popover>
										</div>
										<div
											className={`flex ${
												state !== ApplicationStates.LOADED_QUOTES &&
												state !== ApplicationStates.SCOOPED &&
												state !== ApplicationStates.SCOOPING &&
												"pointer-events-none"
											}`}
										>
											<div
												className="text-[#00243D] text-center hover:opacity-65 hover:cursor-pointer max-w-max flex items-center gap-2 text-lg"
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
												Refresh
											</div>
										</div>
									</div>
								</th>
							</tr>
						</thead>
						<thead className="ltr:text-left rtl:text-right text-[#423627] text-xs">
							<tr>
								<th className="sticky inset-y-0 start-0 p-4">
									<label className="sr-only">Select All</label>

									<input
										type="checkbox"
										id="SelectAll"
										checked={selectAll}
										className="h-4 w-4 rounded border-white"
										onClick={() => handleSelectAll()}
										disabled={state !== ApplicationStates.LOADED_QUOTES}
									/>
								</th>
								<th className="whitespace-nowrap font-medium p-4 text-left">Symbol</th>
								<th className="whitespace-nowrap font-medium p-4 text-right">Balance</th>
								<th className="whitespace-nowrap font-medium p-4 text-right">Scoop Value (Sol)</th>
								<th className="whitespace-nowrap font-medium p-4 text-right">Fee ($BONK)</th>
								<th className="whitespace-nowrap font-medium p-4 text-right flex items-center gap-4 justify-end">
									Token List
									<div className="group relative hover:cursor-help max-w-max">
										<svg
											width="20"
											height="20"
											viewBox="0 0 20 20"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												fill-rule="evenodd"
												clip-rule="evenodd"
												d="M20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10ZM10 9C10.5523 9 11 9.44771 11 10V14.5C11 15.0523 10.5523 15.5 10 15.5C9.44771 15.5 9 15.0523 9 14.5V10C9 9.44771 9.44771 9 10 9ZM10 8C10.5523 8 11 7.55228 11 7C11 6.44772 10.5523 6 10 6C9.44771 6 9 6.44772 9 7C9 7.55228 9.44771 8 10 8Z"
												fill="#FF8D17"
											/>
										</svg>

										<div className="hidden bg-[#FF8D17] text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:block top-6 px-3 -right-6 hover:cursor-auto w-32 text-wrap">
											<a
												className="flex gap-4 items-right hover:font-bold mx-auto max-w-max"
												href={`https://station.jup.ag/docs/token-list/token-list-api#strict-and-all-lists`}
												target="_blank"
											>
												Jupiter token list
											</a>
										</div>
									</div>
								</th>
							</tr>
						</thead>
						<tbody className="relative">
							{state !== ApplicationStates.LOADED_QUOTES && state !== ApplicationStates.SCOOPED && state !== ApplicationStates.SCOOPING && (
								<tr>
									<td
										className="table-cell"
										colSpan={100}
									>
										<div className="text-center font-black uppercase text-lg lg:text-4xl flex items-center gap-2 min-h-48 h-full w-full justify-center animate-pulse">
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
							{state === ApplicationStates.LOADED_QUOTES && filteredData.length === 0 && (
								<tr>
									<td
										className="table-cell"
										colSpan={6}
									>
										<div className="text-center font-black uppercase text-lg lg:text-4xl flex items-center gap-2 min-h-48 h-full w-full justify-center">
											No Data
										</div>
									</td>
								</tr>
							)}
							{sortedAssets.map(([key, entry]) => {
								let burnReturn = getAssetBurnReturn(entry);
								return (
									<tr
										key={key}
										className={`group duration-300 transition-all text-[#423627] font-bold text-sm ${
											entry.checked ? "bg-white/45" : "hover:bg-white/45 !border-l-transparent"
										}`}
									>
										<td className={`p-4 text-center`}>
											{forbiddenTokens.includes(entry.asset.token.symbol) || (
												<input
													className="h-4 w-4 rounded-full border-gray-300"
													checked={entry.checked}
													onChange={(change) => {
														updateAssetList((aL) => {
															aL[entry.asset?.token.address].checked = change.target.checked;
															return aL;
														});
													}}
													type="checkbox"
													disabled={state !== ApplicationStates.LOADED_QUOTES || cannotScoop(entry)}
												/>
											)}
										</td>
										<td className="whitespace-nowrap p-4 text-left">
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
														<path
															d="M9 9H11V17H9V9Z"
															fill="currentColor"
														/>
														<path
															d="M13 9H15V17H13V9Z"
															fill="currentColor"
														/>
													</svg>
												)}
												<p>
													{entry.asset.token.symbol}
													<br />
													{cannotScoop(entry) && (
														<>
															<small>
																<em>
																	Can't scoop right now.
																	<br />
																	Please try again later.
																</em>
															</small>
														</>
													)}
												</p>
											</a>
										</td>
										<td className="whitespace-nowrap p-4 text-right font-mono">
											{(Number(entry.asset?.balance) / 10 ** entry.asset.token.decimals).toLocaleString()}
										</td>
										<td className="whitespace-nowrap p-4 text-right font-mono">
											{(Number(burnReturn.lamportsAmount) / LAMPORTS_PER_SOL).toLocaleString()}
										</td>
										<td className="whitespace-nowrap p-4 text-right font-mono">
											{(Number(burnReturn.feeAmount) / 10 ** 5).toLocaleString()}
										</td>
										<td className="whitespace-nowrap p-4 text-right">{entry.asset?.token.strict && <p>Strict</p>}</td>
										<td className="whitespace-nowrap p-4 text-right">{entry.transactionState && <p>{entry.transactionState}</p>}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<div className="lg:sticky order-first lg:order-last top-12 mb-auto grid gap-4">
					<div className="flex flex-col gap-8 bg-white/45 rounded-3xl p-5 sm:p-10 py-12 border-[1.5px] border-white">
						<p className="font-semibold text-4xl text-center uppercase">Scoop</p>
						<article className="flex items-center gap-4 rounded-lg border-[1.5px] border-white bg-[#FC910366]/40 py-4 px-4 sm:justify-between">
							<span className="rounded-full bg-bonk-white p-2 text-[#FF8D17] sm:order-last">
								<svg
									width="28"
									height="28"
									viewBox="0 0 21 21"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fill-rule="evenodd"
										clip-rule="evenodd"
										d="M4.67792 7.05338C4.53338 5.86202 5.46327 4.8125 6.66337 4.8125H14.3362C15.5363 4.8125 16.4662 5.86203 16.3217 7.05338L15.1312 16.8659C15.0094 17.8699 14.1572 18.625 13.1458 18.625H7.85385C6.84244 18.625 5.99023 17.8699 5.86841 16.8659L4.67792 7.05338ZM7.84181 7.87809C8.39217 7.83205 8.87565 8.24088 8.92169 8.79124L9.46552 15.2917C9.51156 15.842 9.10273 16.3255 8.55236 16.3716C8.002 16.4176 7.51852 16.0088 7.47248 15.4584L6.92866 8.95798C6.88261 8.40762 7.29144 7.92414 7.84181 7.87809ZM12.0787 8.79129C12.1248 8.24093 12.6082 7.83207 13.1586 7.87809C13.709 7.92411 14.1178 8.40758 14.0718 8.95794L13.5283 15.4583C13.4822 16.0087 12.9988 16.4175 12.4484 16.3715C11.898 16.3255 11.4892 15.842 11.5352 15.2917L12.0787 8.79129Z"
										fill="currentColor"
									/>
									<path
										d="M3.59375 5.625L17.4062 5.625"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
									/>
									<path
										d="M7.65625 4.8125V4.8125C7.65625 3.91504 8.38379 3.1875 9.28125 3.1875H11.7188C12.6162 3.1875 13.3438 3.91504 13.3438 4.8125V4.8125"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
									/>
								</svg>
							</span>

							<div>
								<p className="text-2xl font-medium text-gray-900">{(totalPossibleScoop / 10 ** 5).toLocaleString()}</p>

								<p className="text-sm text-gray-500">Possible Scoop</p>
							</div>
						</article>
						<article className="flex items-center gap-4 rounded-lg border-[1.5px] border-white bg-[#FC910366]/40 py-4 px-4 sm:justify-between">
							<span className="rounded-full bg-bonk-white p-2 text-[#FF8D17] sm:order-last">
								<svg
									width="28"
									height="28"
									viewBox="0 0 21 21"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fill-rule="evenodd"
										clip-rule="evenodd"
										d="M2.24805 11.7695C2.24805 9.91768 2.98369 8.14167 4.29315 6.83221C5.60261 5.52276 7.37862 4.78711 9.23047 4.78711C9.39882 4.78711 9.56027 4.85399 9.67932 4.97303C9.79836 5.09207 9.86523 5.25352 9.86523 5.42188V11.1348H15.5781C15.7465 11.1348 15.9079 11.2016 16.027 11.3207C16.146 11.4397 16.2129 11.6012 16.2129 11.7695C16.2129 13.6214 15.4772 15.3974 14.1678 16.7068C12.8583 18.0163 11.0823 18.752 9.23047 18.752C7.37862 18.752 5.60261 18.0163 4.29315 16.7068C2.98369 15.3974 2.24805 13.6214 2.24805 11.7695Z"
										fill="currentColor"
									/>
									<path
										fill-rule="evenodd"
										clip-rule="evenodd"
										d="M11.1348 2.88281C11.1348 2.71446 11.2016 2.55301 11.3207 2.43397C11.4397 2.31492 11.6012 2.24805 11.7695 2.24805C13.6214 2.24805 15.3974 2.98369 16.7068 4.29315C18.0163 5.60261 18.752 7.37862 18.752 9.23047C18.752 9.39882 18.6851 9.56027 18.566 9.67932C18.447 9.79836 18.2855 9.86523 18.1172 9.86523H11.7695C11.6012 9.86523 11.4397 9.79836 11.3207 9.67932C11.2016 9.56027 11.1348 9.39882 11.1348 9.23047V2.88281Z"
										fill="currentColor"
									/>
								</svg>
							</span>

							<div>
								<p className="text-2xl font-medium text-gray-900">{(totalScoop / 10 ** 5).toLocaleString()}</p>

								<p className="text-sm text-gray-500">Total Scoop</p>
							</div>
						</article>
						<button
							className={`inline-block rounded-full bg-white py-4 font-medium text-black transition focus:outline-none focus:ring text-xl ${
								isButtonDisabled ? "hover:cursor-not-allowed opacity-50" : "hover:shadow-xl"
							}`}
							disabled={isButtonDisabled}
							onClick={() => setOpenModal(true)}
						>
							Scoop
						</button>
					</div>
				</div>
			</div>
		);
	};

	return (
		<>
			{" "}
			<div className="flex flex-col gap-4 z-30 relative">
				<ToastContainer />
				<SummaryModal />
				{ScoopList()}
			</div>
		</>
	);
};

export default AssetList;
