import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog"


const SummaryModal = ({
  isOpen,
  setIsOpen,
  selectedItems,
  state,
  ApplicationStates,
  updateAssetList,
  totalScoop,
  scoop,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  selectedItems: any[]
  state: any
  ApplicationStates: any
  updateAssetList: any
  totalScoop: number
  scoop: () => void
}) => {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogContent
        className="w-full max-w-7xl max-h-[80vh] overflow-y-auto"
      >
        <div
          className="relative grid md:grid-cols-[2fr_1fr] gap-8"
          role="dialog"
        >
          <button
            className="absolute end-4 top-4 text-gray-600 transition hover:scale-110"
            onClick={() => setIsOpen(false)}
          >
            <span className="sr-only">Close cart</span>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="mt-4 space-y-6 overflow-hidden overflow-y-auto pr-8">
            <ul className="space-y-4">
              {selectedItems.map((entry, index) => {
                return (
                  <li className="flex items-center gap-4">
                    <img
                      src={entry.asset.token.logoURI}
                      alt="Logo"
                      className="h-16 w-16 rounded object-cover"
                    />

                    <div>
                      <h3 className="text-sm text-gray-900">{entry.asset.token.name}</h3>

                      <dl className="mt-0.5 space-y-px text-[10px] text-gray-600">
                        <div>
                          <dt className="inline">Balance: </dt>
                          <dd className="inline">
                            {(Number(entry.asset?.balance) / 10 ** entry.asset.token.decimals).toLocaleString()}
                          </dd>
                        </div>

                        <div>
                          <dt className="inline">Scoop Value: </dt>
                          <dd className="inline">
                            {entry.quote?.outAmount ? (Number(entry.quote.outAmount) / 10 ** 5).toLocaleString() : "No quote"}
                          </dd>
                        </div>

                        {entry.quote && !entry.swap && (
                          <div>
                            <dt className="inline">
                              <strong>!!! Swap can't be performed, burning instead !!!</strong>
                            </dt>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-2">
                      {state === ApplicationStates.LOADED_QUOTES ? (
                        <button
                          className="text-gray-600 transition hover:text-red-600"
                          onClick={() => {
                            updateAssetList((aL: any) => {
                              aL[entry.asset?.token.address].checked = false;
                              if (selectedItems.length === 1) {
                                setIsOpen(false);
                              }
                              return aL;
                            });
                          }}
                        >
                          <span className="sr-only">Remove item</span>

                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8 11C7.44772 11 7 11.4477 7 12C7 12.5523 7.44772 13 8 13H16C16.5523 13 17 12.5523 17 12C17 11.4477 16.5523 11 16 11H8Z"
                              fill="currentColor"
                            />
                            <path
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      ) : state === ApplicationStates.SCOOPING ? (
                        // Loading
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="animate-spin"
                        >
                          <path
                            opacity="0.2"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                            fill="currentColor"
                          />
                          <path
                            d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z"
                            fill="currentColor"
                          />
                        </svg>
                      ) : entry.transactionState === "Scooped" ? (
                        // Checkmark
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-bonk-green"
                        >
                          <path
                            d="M10.2426 16.3137L6 12.071L7.41421 10.6568L10.2426 13.4853L15.8995 7.8284L17.3137 9.24262L10.2426 16.3137Z"
                            fill="currentColor"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M1 5C1 2.79086 2.79086 1 5 1H19C21.2091 1 23 2.79086 23 5V19C23 21.2091 21.2091 23 19 23H5C2.79086 23 1 21.2091 1 19V5ZM5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z"
                            fill="currentColor"
                          />
                        </svg>
                      ) : (
                        // X
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-bonk-red-400"
                        >
                          <path
                            d="M16.3956 7.75734C16.7862 8.14786 16.7862 8.78103 16.3956 9.17155L13.4142 12.153L16.0896 14.8284C16.4802 15.2189 16.4802 15.8521 16.0896 16.2426C15.6991 16.6331 15.0659 16.6331 14.6754 16.2426L12 13.5672L9.32458 16.2426C8.93405 16.6331 8.30089 16.6331 7.91036 16.2426C7.51984 15.8521 7.51984 15.2189 7.91036 14.8284L10.5858 12.153L7.60436 9.17155C7.21383 8.78103 7.21383 8.14786 7.60436 7.75734C7.99488 7.36681 8.62805 7.36681 9.01857 7.75734L12 10.7388L14.9814 7.75734C15.372 7.36681 16.0051 7.36681 16.3956 7.75734Z"
                            fill="currentColor"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M4 1C2.34315 1 1 2.34315 1 4V20C1 21.6569 2.34315 23 4 23H20C21.6569 23 23 21.6569 23 20V4C23 2.34315 21.6569 1 20 1H4ZM20 3H4C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V4C21 3.44772 20.5523 3 20 3Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-4 md:mt-16 md:sticky top-4 mb-auto">
            <div className="border-t border-gray-100">
              <div className="space-y-4">
                <dl className="space-y-0.5 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <dt>No. of Scooped Tokens</dt>
                    <dd>{selectedItems.length}</dd>
                  </div>

                  <div className="flex justify-between">
                    <dt>Total Expected Scoop Value</dt>
                    <dd>{(totalScoop / 10 ** 5).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <button
              onClick={scoop}
              disabled={state === ApplicationStates.SCOOPED}
              className={`block rounded bg-bonk-yellow px-5 py-3 text-sm text-gray-700 transition w-full ${state === ApplicationStates.SCOOPED ? "hover:cursor-not-allowed" : "hover:bg-bonk-yellow/80"
                }`}
            >
              Confirm
            </button>
            {state === ApplicationStates.SCOOPED && (
              <div className="italic text-sm text-center">Transaction has been processed, please refresh assets</div>
            )}
          </div>
        </div>
        {/* <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account
            and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter> */}
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default SummaryModal