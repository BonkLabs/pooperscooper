import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWalletMultiButton } from "@solana/wallet-adapter-base-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ButtonProps } from "@solana/wallet-adapter-react-ui/lib/types/Button";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

type Props = ButtonProps;

const labels = {
	"change-wallet": "Change wallet",
	connecting: "Connecting ...",
	"copy-address": "Copy address",
	copied: "Copied",
	disconnect: "Disconnect",
	"has-wallet": "Connect",
	"no-wallet": "Select Wallet",
} as const;

export default function WalletButton({ children, ...props }: Props) {
	const { connection } = useConnection();
	const { setVisible: setModalVisible } = useWalletModal();
	const { buttonState, onConnect, onDisconnect, publicKey, walletIcon, walletName } = useWalletMultiButton({
		onSelectWallet() {
			setModalVisible(true);
		},
	});

	const [balance, setBalance] = useState<number | null>(null);

	const fetchBalance = async () => {
		const fetchedBalance = (await connection.getBalance(publicKey!)) / LAMPORTS_PER_SOL;
		setBalance(fetchedBalance);
	};

	useEffect(() => {
		if (publicKey) {
			fetchBalance();
		}
	}, [publicKey]);

	const [copied, setCopied] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const ref = useRef<HTMLUListElement>(null);
	useEffect(() => {
		const listener = (event: MouseEvent | TouchEvent) => {
			const node = ref.current;

			// Do nothing if clicking dropdown or its descendants
			if (!node || node.contains(event.target as Node)) return;

			setMenuOpen(false);
		};

		document.addEventListener("mousedown", listener);
		document.addEventListener("touchstart", listener);

		return () => {
			document.removeEventListener("mousedown", listener);
			document.removeEventListener("touchstart", listener);
		};
	}, []);
	const content = useMemo(() => {
		if (children) {
			return children;
		} else if (publicKey) {
			const base58 = publicKey.toBase58();
			return base58.slice(0, 4) + ".." + base58.slice(-4);
		} else if (buttonState === "connecting" || buttonState === "has-wallet") {
			return labels[buttonState];
		} else {
			return labels["no-wallet"];
		}
	}, [buttonState, children, labels, publicKey]);

	const { connected } = useWallet();

	if (!connected) {
		return null;
	}

	return (
		<div className="wallet-adapter-dropdown w-full !fixed bottom-8 right-8 z-50">
			<button
				className="bg-[#00243D] text-bonk-white p-2 px-4 rounded-full flex gap-2 items-center ml-auto"
				onClick={() => {
					switch (buttonState) {
						case "no-wallet":
							setModalVisible(true);
							break;
						case "has-wallet":
							if (onConnect) {
								onConnect();
							}
							break;
						case "connected":
							setMenuOpen(true);
							break;
					}
				}}
			>
				<div className="flex justify-center items-center rounded-full size-8">
					<img
						src={walletIcon}
						alt=""
					/>
				</div>
				<div className="text-xs flex flex-col text-left">
					<p className="font-semibold">{content}</p>
					<p>
						{balance?.toLocaleString(undefined, {
							maximumFractionDigits: 3,
						})}{" "}
						SOL
					</p>
				</div>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					className="ml-5"
				>
					<path d="m6 9 6 6 6-6"></path>
				</svg>
			</button>
			<ul
				aria-label="dropdown-list"
				className={`wallet-adapter-dropdown-list !top-0 !bottom-full ${menuOpen && "wallet-adapter-dropdown-list-active"}`}
				ref={ref}
				role="menu"
			>
				{publicKey ? (
					<li
						className="wallet-adapter-dropdown-list-item"
						onClick={async () => {
							await navigator.clipboard.writeText(publicKey.toBase58());
							setCopied(true);
							setTimeout(() => setCopied(false), 400);
						}}
						role="menuitem"
					>
						{copied ? labels["copied"] : labels["copy-address"]}
					</li>
				) : null}
				<li
					className="wallet-adapter-dropdown-list-item"
					onClick={() => {
						setModalVisible(true);
						setMenuOpen(false);
					}}
					role="menuitem"
				>
					{labels["change-wallet"]}
				</li>
				{onDisconnect ? (
					<li
						className="wallet-adapter-dropdown-list-item"
						onClick={() => {
							onDisconnect();
							setMenuOpen(false);
						}}
						role="menuitem"
					>
						{labels["disconnect"]}
					</li>
				) : null}
			</ul>
		</div>
	);
}
