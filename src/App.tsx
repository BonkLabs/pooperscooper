import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  useConnection,
  useWallet,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
  UnsafeBurnerWalletAdapter,
  PhantomWalletAdapter,
  LedgerWalletAdapter,
  SolflareWalletAdapter,
  SolongWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import React, { FC, ReactNode, useMemo } from "react";
import { render } from "react-dom";
import AssetList from "./components/AssetList";
import Info from "./components/Info";
import Header from "./components/Header";

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const App: FC = () => {
  return (
    <Context>
      <Content />
    </Context>
  );
};
export default App;

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  const network =
    "https://magical-twilight-road.solana-mainnet.quiknode.pro/8ff7d41d2e19dfdd6d4c1e0153cc39de3b118901/";

  // You can also provide a custom RPC endpoint.
  const endpoint = React.useMemo(() => network, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolongWalletAdapter(),
      new TorusWalletAdapter()
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const Content: FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  return (
    <div className="bg-gradient-to-b from-[#FC8E03] to-[#FFD302] p-4 sm:p-8 md:p-16 lg:p-24 min-h-screen relative">
      <Header />
      <Info />
      <div className="min-h-[30vh]">
        {wallet && connection && wallet.publicKey ? (
          <AssetList />
        ) : (
          <div className="text-white text-center pt-4 font-bold text-2xl italic h-[30vh] flex items-center justify-center relative z-40">
            Connect your wallet to scoop up unwanted assets
          </div>
        )}
        <img
          src={`/images/bonk_logo_transparent.png`}
          width={500}
          className="absolute bottom-0 left-0"
          alt="$BONK Logo"
        />
      </div>
    </div>
  );
};
