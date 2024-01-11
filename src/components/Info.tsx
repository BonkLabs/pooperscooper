const Info = () => {
  const steps = [
    {
      title: "Wait for assets to load",
      description:
        "Scooper will check your wallet for assets that can be swapped and accounts that can be closed and present them in a list below",
      image: `/images/1.png`,
    },
    {
      title: "Select assets for Scooping",
      description:
        "Review the assets in the list and check any assets you would like to Scoop, then press scoop. Or use Scoop all",
      image: `/images/2.png`,
    },
    {
      title: "Review summary",
      description:
        "Make sure only assets you want to Scoop are shown in the Summary. Press confirm and then sign the transaction if you are satisfied",
      image: `/images/3.png`,
    },
    {
      title: "Scooper scoops",
      description:
        "Scooper will now issue the transactions for each asset to be scooped and let you know when the process is complete.",
      image: `/images/4.png`,
    },
  ];

  return (
    <section className="bg-[#FFD302] text-white rounded-3xl relative px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16 mb-4 shadow-[-10px_10px_20px_5px_rgba(0,0,0,0.4)] z-20">
      <div className="max-w-screen-xl">
        <div className="max-w-xl">
          <h2 className="text-3xl font-black sm:text-6xl uppercase">
            Pooper Scooper
          </h2>

          <p className="mt-4 text-gray-800 font-semibold tracking-wide">
            Airdrops and adverts clutter your wallet. This tool allows you to quickly
            "Scoop" all your unwanted assets into $BONK via
             <a href="https://jup.ag/"> jup.ag</a> swaps.<br/>
            Token accounts for scooped assets are closed, returning the rent to you as Solana.
            (Typically 0.0024 Solana per account closed).
            A 0.1% fee is currently taken from all swaps, no fee is taken from account closures.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 md:gap-12">
          {steps.map((step, index) => {
            const { title, description, image } = step;
            return (
              <div className="flex items-start gap-4">
                {/* <span className="shrink-0 rounded-lg bg-[#FC8E03] p-4 text-center">
                  <p className="h-5 w-5 font-black text-3xl">{index + 1}</p>
                </span> */}
                <img src={image} alt="" width={50} />

                <div>
                  <h2 className="text-xl sm:text-3xl font-black uppercase">
                    {title}
                  </h2>

                  <p className="mt-1 text-sm text-gray-800 font-semibold tracking-wide">
                    {description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Info;

