import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const Info = () => {
  const steps = [
    {
      title: "Wait for assets to load",
      description:
        "Scooper will check your wallet for assets that can be swapped and accounts that can be closed and present them in a list below",
    },
    {
      title: "Select assets for Scooping",
      description:
        "Review the assets in the list and check any assets you would like to Scoop, then press scoop. Or use Scoop all",
    },
    {
      title: "Review summary",
      description:
        "Make sure only assets you want to Scoop are shown in the Summary. Press confirm and then sign the transaction if you are satisfied",
    },
    {
      title: "Scooper scoops",
      description:
        "Scooper will now issue the transactions for each asset to be scooped and let you know when the process is complete.",
    },
  ];

  return (
    <section className="bg-[#004f2d] text-white rounded-3xl relative px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16 mb-4">
      <div className="block md:absolute !top-12 !right-12 pb-4">
        <WalletMultiButton />
      </div>
      <div className="max-w-screen-xl">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold sm:text-4xl">Doodie Bag</h2>

          <p className="mt-4 text-gray-300">
            Airdrops and adverts clutter your wallet. This tool allows you to
            quickly "Scoop" all your unwanted assets into Bonk via jup.ag Token
            accounts for scooped assets are closed, returning the Sol rent to
            you.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 md:gap-12 lg:grid-cols-3">
          {steps.map((step, index) => {
            const { title, description } = step;
            return (
              <div className="flex items-start gap-4">
                <span className="shrink-0 rounded-lg bg-[#091e05] p-4 text-center">
                  <p className="h-5 w-5">{index + 1}</p>
                </span>

                <div>
                  <h2 className="text-lg font-bold">{title}</h2>

                  <p className="mt-1 text-sm text-gray-300">{description}</p>
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
