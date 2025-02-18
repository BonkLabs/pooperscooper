import { ConnectionProvider, useConnection, useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, LedgerWalletAdapter, SolflareWalletAdapter, SolongWalletAdapter, TorusWalletAdapter } from "@solana/wallet-adapter-wallets";
import React, { FC, ReactNode, useMemo, useState } from "react";
import AssetList from "./components/AssetList";
import Info from "./components/Info";
import Header from "./components/Header";
import { registerTipLinkWallet } from "@tiplink/wallet-adapter";
import { TipLinkWalletAutoConnectV2 } from "@tiplink/wallet-adapter-react-ui";
import WalletButton from "./components/WalletButton";
import NFTList from "./components/NFTList";

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const network = process.env.REACT_APP_RPC_URL!;

registerTipLinkWallet({
	title: "BONKscooper",
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
		() => [new PhantomWalletAdapter(), new LedgerWalletAdapter(), new SolflareWalletAdapter(), new SolongWalletAdapter(), new TorusWalletAdapter()],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[network]
	);

	return (
		<ConnectionProvider endpoint={endpoint}>
			<WalletProvider
				wallets={wallets}
				autoConnect
			>
				<TipLinkWalletAutoConnectV2
					isReady
					query={{}}
				>
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
	// const [activeTab, setActiveTab] = useState<'tokens' | 'nfts'>('tokens');
	const [isTabLoading, setIsTabLoading] = useState(false);

	const handleTabChange = (tab: "tokens" | "nfts") => {
		setIsTabLoading(true);
		// setActiveTab(tab);
		// Petit délai pour s'assurer que le composant a le temps de se monter
		setTimeout(() => {
			setIsTabLoading(false);
		}, 100);
	};

	return (
		<div className="bg-gradient-to-r from-[#FC8E03] to-[#FFD302] p-4 sm:p-8 md:p-16 lg:p-24 min-h-screen relative">
			<Header />
			<Info />
			<div className="min-h-[30vh] pb-24">
				{wallet && connection && wallet.publicKey ? (
					<div>
						{/* <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 mb-8">
							<div className="bg-white/60 p-2 sm:p-3 rounded-full w-full sm:w-fit mx-auto border-2 border-white shadow-lg flex flex-row gap-2">
                                <button
									className={`flex-1 sm:flex-initial px-4 sm:px-12 py-3 sm:py-4 rounded-full transition-all duration-200 font-bold text-lg sm:text-xl min-w-0 sm:min-w-[180px] ${
										activeTab === "tokens"
											? "bg-[#FC8E03] text-white shadow-lg transform scale-[1.02]"
											: "bg-white/80 text-[#FC8E03] hover:bg-white hover:text-[#FC8E03]"
									}`}
									onClick={() => handleTabChange("tokens")}
									disabled={isTabLoading}
								>
									Tokens
								</button>
								<button
									className={`flex-1 sm:flex-initial px-4 sm:px-12 py-3 sm:py-4 rounded-full transition-all duration-200 font-bold text-lg sm:text-xl min-w-0 sm:min-w-[180px] ${
										activeTab === "nfts"
											? "bg-[#FC8E03] text-white shadow-lg transform scale-[1.02]"
											: "bg-white/80 text-[#FC8E03] hover:bg-white hover:text-[#FC8E03]"
									}`}
									onClick={() => handleTabChange("nfts")}
									disabled={isTabLoading}
								>
									NFTs
								</button> 
                            </div>
						</div> */}
						<div className="transition-all duration-300 ease-in-out transform">
							{isTabLoading ? <LoadingSpinner /> : <AssetList />}
							{/* {isTabLoading ? <LoadingSpinner /> : activeTab === "tokens" ? <AssetList /> : <NFTList />} */}
						</div>
					</div>
				) : (
					<div className="text-[#00243D] text-center pt-4 h-[50vh] flex flex-col gap-8 items-center justify-center relative z-40 bg-white/45 rounded-[34px] border-[1.5px] border-white">
						<p className="font-medium text-3xl ">Connect your wallet to scoop up unwanted assets</p>
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
					className="absolute bottom-0 left-0 opacity-50 sm:opacity-100"
					alt="$BONK Logo"
				/>
				<WalletButton />
			</div>
		</div>
	);
};

const LoadingSpinner = () => (
	<div className="flex items-center justify-center h-40">
		<div className="relative w-16 h-16">
			<div className="absolute top-0 left-0 w-full h-full border-4 border-white/30 rounded-full"></div>
			<div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-white rounded-full animate-spin"></div>
		</div>
	</div>
);
