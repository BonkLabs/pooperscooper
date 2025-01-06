import { getTotalFee } from "../scooper";
import { useWallet } from "@solana/wallet-adapter-react";

const Info = () => {
  const { connected } = useWallet();

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
    <section className="relative sm:py-6 mb-4">
      <div>
        <div className="flex md:flex-row flex-col gap-8 sm:gap-16">
          <p className="text-white font-medium tracking-wide text-lg sm:text-3xl">
            Airdrops and adverts clutter your wallet. This tool allows you to
            quickly "Scoop" all your unwanted assets into $BONK via
            <a href="https://jup.ag/">
              {" "}
              <u>Jupiter swaps.</u>
            </a>{" "}
          </p>

          <div className="text-[#1F2937] tracking-wide space-y-4">
            <p className="text-sm sm:text-lg">
              Token accounts for scooped assets are closed, returning the rent
              to you as Solana. (Typically 0.0024 Solana per account closed). A{" "}
              {getTotalFee().toLocaleString()}% fee is currently taken from all
              swaps, no fee is taken from account closures.
            </p>
            <p className="opacity-60 text-xs">
              * If the swap can't be performed the token account and amount will
              be burned instead, caution mf !!!
            </p>
          </div>
        </div>

        {connected && (
          <div className="mt-8 grid sm:grid-cols-2 gap-4 md:mt-16 md:grid-cols-4 md:gap-12 bg-white/45 p-4 sm:p-8 rounded-[34px] border-[1.5px] border-white">
            {steps.map((step, index) => {
              const { title, description } = step;
              return (
                <div className="flex items-start gap-4">
                  <div className="bg-[#FFEC36] rounded-full text-xl sm:text-3xl font-semibold min-h-8 sm:min-h-12 min-w-8 sm:min-w-12 flex justify-center items-center">
                    {index + 1}
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold uppercase">
                      {title}
                    </h2>

                    <p className="mt-1 text-sm text-[#31271B] tracking-wide">
                      {description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Info;
