import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  useConnection,
  useWallet,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  useWalletModal,
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
import { registerTipLinkWallet } from "@tiplink/wallet-adapter";
import { TipLinkWalletAutoConnectV2 } from "@tiplink/wallet-adapter-react-ui";
import WalletButton from "./components/WalletButton";

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const network = process.env.REACT_APP_RPC_URL!;

registerTipLinkWallet({
  title: "Pooper Scooper",
  clientId: "205a8337-937e-42ea-96b5-577c77ed7153",
  theme: "light", // pick between "dark"/"light"/"system",
  rpcUrl: network,
});

const App: FC = () => {
  return (
    <Context>
      <Content />
    </Context>
  );
};
export default App;

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  // You can also provide a custom RPC endpoint.
  const endpoint = React.useMemo(() => network, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolongWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <TipLinkWalletAutoConnectV2 isReady query={{}}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </TipLinkWalletAutoConnectV2>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const Content: FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <div className="bg-gradient-to-r from-[#FC8E03] to-[#FFD302] p-4 sm:p-8 md:p-16 lg:p-24 min-h-screen relative">
      <Header />
      <Info />
      <div className="min-h-[30vh]">
        {wallet && connection && wallet.publicKey ? (
          <AssetList />
        ) : (
          <div className="text-[#00243D] text-center pt-4 h-[50vh] flex flex-col gap-8 items-center justify-center relative z-40 bg-white/45 rounded-[34px] border-[1.5px] border-white">
            <p className="font-medium text-3xl ">
              Connect your wallet to scoop up unwanted assets
            </p>
            <button
              className="bg-bonk-white text-[#00243D] p-12 py-3 rounded-full flex gap-2 items-center z-30"
              onClick={() => setVisible(true)}
            >
              Connect Wallet
            </button>
          </div>
        )}
        <img
          src={`/images/bonk_logo_transparent.png`}
          width={200}
          className="absolute bottom-0 left-0"
          alt="$BONK Logo"
        />
        <WalletButton />
      </div>
    </div>
  );
};
