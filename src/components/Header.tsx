const Header = () => {
  return (
    <header className="relative flex flex-col-reverse sm:flex-row justify-between items-center mb-4 sm:mb-0">
      <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl uppercase text-bonk-white font-bold text-center">
        BONKscooper
      </h1>
      <img src={`/images/bonkscooper-logo.png`} alt="Doodie Logo" width={300} />
    </header>
  );
};

export default Header;
