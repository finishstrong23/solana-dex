"use client";

interface TransactionModalProps {
  signature: string;
  onClose: () => void;
}

export default function TransactionModal({
  signature,
  onClose,
}: TransactionModalProps) {
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-8 max-w-sm w-full mx-4">
        {/* Success Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-bold text-center mb-2">
          Transaction Submitted
        </h3>
        <p className="text-dark-400 text-center text-sm mb-6">
          Your swap has been submitted to the network
        </p>

        {/* Transaction Hash */}
        <div className="bg-dark-800 rounded-lg p-3 mb-6">
          <div className="text-xs text-dark-400 mb-1">Transaction Hash</div>
          <div className="text-sm font-mono text-dark-200 break-all">
            {signature.slice(0, 20)}...{signature.slice(-20)}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 text-center bg-primary-600 hover:bg-primary-700 rounded-xl font-semibold transition-colors"
          >
            View on Explorer
          </a>
          <button
            onClick={onClose}
            className="block w-full py-3 text-center bg-dark-800 hover:bg-dark-700 rounded-xl font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
