import React from "react";

const DeprecationOverlay: React.FC = () => {
	const handleRedirect = () => {
		window.location.href = "https://junk.fun/";
	};

	return (
		<div className="fixed inset-0 z-[9999] bg-gradient-to-r from-[#FC8E03] to-[#FFD302] flex items-center justify-center p-4">
			<div className="bg-white/90 rounded-[34px] border-[1.5px] border-white shadow-2xl max-w-2xl w-full p-8 sm:p-12 text-center max-h-[90vh] overflow-y-auto">
				<h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#00243D] mb-6 uppercase">
					We've Moved!
				</h2>
				<p className="text-lg sm:text-xl md:text-2xl text-[#00243D] mb-8 font-medium">
					BONKscooper has been deprecated. <br/> Visit our new product:
				</p>
                <img src="/images/junkfun.jpg" alt="Junk.fun Logo" width={200} height={200} className="rounded-full mx-auto mb-6" />
				<button
					onClick={handleRedirect}
					className="bg-gradient-to-r from-[#FC8E03] to-[#FFD302] text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold text-lg sm:text-xl md:text-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 uppercase"
				>
					Go to Junk.fun →
				</button>
			</div>
		</div>
	);
};

export default DeprecationOverlay;

