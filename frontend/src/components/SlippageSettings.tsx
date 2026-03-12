"use client";

const PRESETS = [0.1, 0.5, 1.0];

interface SlippageSettingsProps {
  slippage: number;
  setSlippage: (value: number) => void;
}

export default function SlippageSettings({
  slippage,
  setSlippage,
}: SlippageSettingsProps) {
  return (
    <div className="mb-4 p-3 bg-dark-800 rounded-xl">
      <div className="text-sm text-dark-400 mb-2">Slippage Tolerance</div>
      <div className="flex items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => setSlippage(preset)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              slippage === preset
                ? "bg-primary-600 text-white"
                : "bg-dark-700 text-dark-300 hover:bg-dark-600"
            }`}
          >
            {preset}%
          </button>
        ))}
        <div className="flex-1 flex items-center gap-1">
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 bg-dark-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-500"
            step="0.1"
            min="0.01"
            max="50"
          />
          <span className="text-sm text-dark-400">%</span>
        </div>
      </div>
      {slippage > 5 && (
        <p className="text-xs text-yellow-400 mt-2">
          High slippage tolerance. Your transaction may be frontrun.
        </p>
      )}
    </div>
  );
}
