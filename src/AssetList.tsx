import React from "react";
import {
    useAnchorWallet,
    useConnection,
    useWallet,
    WalletContextState,
} from '@solana/wallet-adapter-react';
import { Connection, GetProgramAccountsFilter, TransactionInstruction, VersionedTransaction, sendAndConfirmTransaction, PublicKey } from "@solana/web3.js";
import { isBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createJupiterApiClient, DefaultApi, QuoteGetRequest, SwapResponse, SwapPostRequest, QuoteResponse } from '@jup-ag/api';

interface Token {
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI: string;
    tags: string[];
    strict?: boolean;
};

/* Fetch all the token accounts for a wallet */
async function getTokenAccounts(wallet: string, solanaConnection: Connection, tokenList: { [id: string] : Token; }) {
    const filters:GetProgramAccountsFilter[] = [
        {
          dataSize: 165,
        },
        {
          memcmp: {
            offset: 32,
            bytes: wallet,
          },            
        }];
    const accountsOld = await solanaConnection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID,
        {filters: filters}
    );
    const filtersOld:GetProgramAccountsFilter[] = [
        {
          dataSize: 182,
        },
        {
          memcmp: {
            offset: 32,
            bytes: wallet,
          },            
        }];
    const accountsNew = await solanaConnection.getParsedProgramAccounts(
        new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
        {filters: filtersOld}
    );

    const accounts = [...accountsOld, ...accountsNew];
    
    console.log(`Found ${accounts.length} token account(s) for wallet ${wallet}.`);
    var tokens : {account: any, token: any, balance: any}[] = [];

    accounts.forEach((account, i) => {
        const parsedAccountInfo: any = account.account.data;
        console.log(parsedAccountInfo)
        const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
        if (tokenList[mintAddress]) {
            console.log("Recognised token: " + tokenList[mintAddress].symbol + " have: " + tokenBalance.toString())
            tokens.push({account: account, token: tokenList[mintAddress], balance: tokenBalance.toString()})
        }
    });
    return tokens;
}

const AssetList: React.FC = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [swapList, setSwapList] = React.useState<{ [id: string] : {asset: any, quote: QuoteResponse, swap: SwapResponse, checked: boolean, transactionState?: string}}>({});
    const [walletAddress, setWalletAddress] = React.useState("");
    const [tokens, setTokens] = React.useState<{ [id: string] : Token; }>({});
    const [totalScoop, setTotalScoop] = React.useState(0);
    const [possibleScoop, setPossibleScoop] = React.useState(0);
    const [forcedCounter, setForcedCounter] = React.useState(0);
    const [scooped, setScooped] = React.useState(false);

    function forceUpdate() {
        setForcedCounter(s => (s+1));
    }

    var loading = false;
    const scoop = () => {
        setScooped(true)
        let transactions: [string, VersionedTransaction][] = [];
        Object.entries(swapList).forEach(([key, swap]) => {
            if (swap.checked) {
                // deserialize the transaction
                const swapTransactionBuf = atob(swap.swap.swapTransaction);
                const swapTransactionAr = new Uint8Array(swapTransactionBuf.length);

                for (let i = 0; i < swapTransactionBuf.length; i++) {
                    swapTransactionAr[i] = swapTransactionBuf.charCodeAt(i);
                }
                var transaction = VersionedTransaction.deserialize(swapTransactionAr);
                transactions.push([swap.asset.token.address, transaction]);
            }
        });

        transactions.forEach(([id, transaction]) => {
            if (wallet.sendTransaction) {
                swapList[id].transactionState = "Scooping"
                forceUpdate()
                wallet.sendTransaction(transaction, connection).then( tx => {
                    console.log("Transaction Success!")
                    swapList[id].transactionState = "Scooped"
                    forceUpdate()
                }).catch( err => {
                    console.log("Transaction failed!")
                    console.log(err)
                    swapList[id].transactionState = "Failed to scoop"
                    forceUpdate()
                })
            }
        })
    }

    /* Set the wallet address once until it changes */
    if (wallet.connected && wallet.publicKey && connection) {
        if ( walletAddress != wallet.publicKey.toString() ) {
            setWalletAddress(wallet.publicKey.toString())
        }
    }

    /* Load the Jupiter Quote API */
    const [jupiterQuoteApi, setQuoteApi] = React.useState<DefaultApi|null>()
    React.useEffect(() => {
        let quoteApi = createJupiterApiClient();
        fetch("https://token.jup.ag/all").then( data => {
            data.json().then( allList => { 
                const tokenMap: {[id: string] : Token} = {};
                allList.forEach((token: Token) => {
                    tokenMap[token.address] = token
                })
                fetch("https://token.jup.ag/strict").then( data => {
                    data.json().then( strictList => { 
                        strictList.forEach((token: Token) => {
                            tokenMap[token.address].strict = true;
                        })
                        setTokens(tokenMap);
                        setQuoteApi(quoteApi);
                    })
                });
            })
        })
    }, [])

    /* Load information about users tokens, add any tokens which are eligible for swap to list */
    React.useEffect(() => {
        if (walletAddress && jupiterQuoteApi && tokens && !loading) {
            loading = true;
            setSwapList({})
            getTokenAccounts(walletAddress, connection, tokens).then((assets) => {
                assets.forEach(asset => {
                    const quoteRequest : QuoteGetRequest = {
                        inputMint: asset.token.address,
                        outputMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
                        amount: Math.floor(asset.balance * Math.pow(10, asset.token.decimals)),
                        onlyDirectRoutes: false,
                        asLegacyTransaction: false,
                        platformFeeBps: 100
                    }
                    console.log(quoteRequest)

                    jupiterQuoteApi.quoteGet(quoteRequest).then( quote => {
                        let rq : SwapPostRequest = {
                            swapRequest: {
                                userPublicKey: walletAddress,
                                quoteResponse: quote
                            }
                        }
                        jupiterQuoteApi.swapPost(rq).then( swap => {
                            setSwapList(s => ({...s, [asset.token.address]: {asset: asset, quote: quote, swap: swap, checked: false}}))
                        }).catch( err => {
                            console.log("Failed to get swap for " + asset.token.symbol)
                            console.log(err)
                        });
                    }).catch( err => {
                        console.log("Failed to get quote for " + asset.token.symbol)
                        console.log(err)
                    });
                });
            });
        }
    }, [walletAddress, jupiterQuoteApi, tokens]);

    /* Maintain counters of the total possible yield and yield from selected swaps */
    React.useEffect(() => {
        if (walletAddress && jupiterQuoteApi && tokens) {
            var ts = 0;
            var tps = 0;
            Object.entries(swapList).forEach(([key, swap]) => {
                if (swap.checked) {
                    ts += Number(swap.quote.outAmount)
                }
                tps += Number(swap.quote.outAmount)
            });
            setPossibleScoop(tps);
            setTotalScoop(ts);
        }
    }, [swapList, forcedCounter]);

    if (!jupiterQuoteApi || !walletAddress) {
        return (<></>)
    }
    return (
        <>
            <div>
                <table>
                    <tbody>
                    <tr>
                        <th>Symbol</th>
                        <th>Balance</th>
                        <th>Scoop Value</th>
                        <th>Strict</th>
                        <th>Scoop?</th>
                        <th>Status</th>
                    </tr>
                    {
                        Object.entries(swapList).map(([key, entry]) => (
                            <tr key={entry.asset.token.address}>
                                <th>{entry.asset.token.symbol}</th>
                                <th>{entry.asset.balance}</th>
                                <th>{entry.quote.outAmount}</th>
                                <th>{entry.asset.token.strict && <p>Strict</p>}</th>
                                <th><input onChange={(change) => {swapList[entry.asset.token.address].checked = change.target.checked; forceUpdate()}} type="checkbox"/></th>
                                <th>{entry.transactionState && <p>{entry.transactionState}</p>}</th>
                            </tr>
                        ))
                    }
                    </tbody> 
                </table>
                <div>
                    <div>
                        <label>Possible Scoop:</label>
                        <label>{possibleScoop}</label>
                    </div>
                    <div>
                        <label>Total Scoop:</label>
                        <label>{totalScoop}</label>
                    </div>
                    
                    { scooped || <button onClick={scoop}>Scoop</button> }
                </div>
            </div>
        </>
    );
};

export default AssetList;
