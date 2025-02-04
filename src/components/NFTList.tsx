import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { FC, useEffect, useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { NFTService } from "../services/nftService";

interface NFT {
	name: string;
	image: string;
	mint: string;
	value: number; // Prix en SOL (obligatoire maintenant)
}

const LoadingSpinner = () => (
	<div className="flex items-center justify-center h-40">
		<div className="relative w-16 h-16">
			<div className="absolute top-0 left-0 w-full h-full border-4 border-white/30 rounded-full"></div>
			<div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-white rounded-full animate-spin"></div>
		</div>
	</div>
);

const NFTList: FC = () => {
	const { connection } = useConnection();
	const { publicKey, signTransaction } = useWallet();
	const [nfts, setNfts] = useState<NFT[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
	const [isScooping, setIsScooping] = useState(false);
	const MAX_SELECTION = 5;

	const handleSelectAll = () => {
		if (selectedNFTs.size === nfts.length || selectedNFTs.size > 0) {
			setSelectedNFTs(new Set());
		} else {
			const firstFiveNFTs = nfts.slice(0, MAX_SELECTION).map((nft) => nft.mint);
			setSelectedNFTs(new Set(firstFiveNFTs));
		}
	};

	const handleSelectNFT = (mint: string) => {
		const newSelected = new Set(selectedNFTs);
		if (newSelected.has(mint)) {
			newSelected.delete(mint);
		} else {
			if (newSelected.size >= MAX_SELECTION) {
				return;
			}
			newSelected.add(mint);
		}
		setSelectedNFTs(newSelected);
	};

	const selectAllButtonText = () => {
		if (selectedNFTs.size > 0) {
			return "Unselect";
		}
		return "Select";
	};

	useEffect(() => {
		const fetchNFTs = async () => {
			if (!publicKey) return;

			try {
				setLoading(true);

				const nftList = await NFTService.fetchNFTs(publicKey.toString());
				setNfts(nftList);
			} catch (error) {
				setNfts([]);
			} finally {
				setLoading(false);
			}
		};

		fetchNFTs();
	}, [publicKey]);

	const handleScoop = async () => {
		if (!publicKey || !signTransaction || selectedNFTs.size === 0) return;

		try {
			setIsScooping(true);
			const transaction = await NFTService.prepareScoopTransaction(Array.from(selectedNFTs), publicKey.toString());

			const signedTransaction = await signTransaction(transaction);
			const signature = await connection.sendRawTransaction(signedTransaction.serialize());
			const latestBlockhash = await connection.getLatestBlockhash();
			const confirmation = await connection.confirmTransaction(
				{
					signature,
					...latestBlockhash,
				},
				"confirmed"
			);

			const updatedNFTs = nfts.filter((nft) => !selectedNFTs.has(nft.mint));
			setNfts(updatedNFTs);
			setSelectedNFTs(new Set());
		} catch (error) {
			console.error("Error scooping NFTs:", error);
		} finally {
			setIsScooping(false);
		}
	};

	const renderScoopButton = () => {
		if (selectedNFTs.size === 0) return null;

		return (
			<button
				onClick={handleScoop}
				disabled={isScooping}
				className={`w-full sm:w-auto px-8 py-4 bg-gradient-to-br from-[#FC8E03] to-[#FFD302] text-white text-lg rounded-2xl font-bold shadow-[0_4px_20px_rgba(252,142,3,0.3)] hover:shadow-[0_4px_24px_rgba(252,142,3,0.45)] transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 ${
					isScooping ? "opacity-50 cursor-not-allowed" : ""
				}`}
			>
				{isScooping ? (
					<div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
				) : (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						className="w-6 h-6"
					>
						<path
							fillRule="evenodd"
							d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452z"
							clipRule="evenodd"
						/>
					</svg>
				)}
				{isScooping ? "Scooping..." : `Scoop ${selectedNFTs.size} NFT${selectedNFTs.size !== 1 ? "s" : ""}`}
			</button>
		);
	};

	if (loading) {
		return <LoadingSpinner />;
	}

	if (nfts.length === 0) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="bg-white/45 backdrop-blur-sm p-8 rounded-2xl shadow-xl border-[1.5px] border-white max-w-md w-full transform transition-all hover:scale-[1.02]">
					<div className="flex flex-col items-center text-center">
						<div className="relative mb-6">
							<div className="absolute inset-0 bg-gradient-to-br from-[#FC8E03] to-[#FFD302] rounded-full opacity-20 blur-xl"></div>
							<img
								src="/images/bonk_logo_transparent.png"
								alt="No NFTs"
								className="relative w-24 h-24 object-contain"
							/>
						</div>
						<h2 className="text-[#00243D] font-bold text-2xl mb-3">No NFTs Found</h2>
						<p className="text-[#00243D]/70 text-lg max-w-sm">Connect your wallet or switch to a wallet containing NFTs to start scooping</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white/45 backdrop-blur-sm p-6 rounded-2xl shadow-xl border-[1.5px] border-white">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<div className="flex items-center gap-3">
					<button
						onClick={handleSelectAll}
						className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
							selectedNFTs.size > 0 ? "bg-[#FC8E03] text-white" : "bg-white/60 text-[#FC8E03] hover:bg-[#FC8E03]/10"
						}`}
					>
						<div className="relative w-5 h-5 flex items-center justify-center">
							<input
								type="checkbox"
								checked={selectedNFTs.size > 0}
								onChange={handleSelectAll}
								className="absolute opacity-0 w-full h-full cursor-pointer"
							/>
							<div
								className={`w-4 h-4 rounded border-2 transition-colors ${selectedNFTs.size > 0 ? "border-white bg-white" : "border-[#FC8E03]"}`}
							/>
						</div>
						<span className="font-semibold">{selectAllButtonText()}</span>
					</button>
					<span className="text-[#00243D] font-medium">{selectedNFTs.size}/5</span>
				</div>
				{renderScoopButton()}
			</div>
			<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
				{nfts.map((nft) => (
					<div
						key={nft.mint}
						onClick={() => handleSelectNFT(nft.mint)}
						className={`group relative bg-white/45 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
							selectedNFTs.has(nft.mint) ? "ring-2 ring-[#FC8E03] transform scale-[1.02]" : "hover:scale-[1.02]"
						}`}
					>
						<div className="absolute top-1.5 right-1.5 z-10">
							<div
								className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
									selectedNFTs.has(nft.mint) ? "bg-[#FC8E03]" : "bg-black/20 group-hover:bg-black/40"
								}`}
							>
								<div className={`w-2.5 h-2.5 rounded-sm transition-transform ${selectedNFTs.has(nft.mint) ? "bg-white" : "bg-white/80"}`} />
							</div>
						</div>
						<div className="aspect-square w-full">
							<img
								src={nft.image}
								alt={nft.name}
								className="w-full h-full object-cover"
								onError={(e) => {
									(e.target as HTMLImageElement).src = "/images/bonk_logo_transparent.png";
								}}
							/>
						</div>
						<div className="p-2 bg-white/60 backdrop-blur-sm">
							<h3 className="font-medium text-[#00243D] text-xs truncate">{nft.name}</h3>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default NFTList;
