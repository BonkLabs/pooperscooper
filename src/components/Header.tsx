import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const Header = () => {
  return (
    <header className="relative flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-0">
      <img src={`/images/scooper_logo.png`} alt="Doodie Logo" width={300} />
      <WalletMultiButton />
    </header>
  );
};

export default Header;
