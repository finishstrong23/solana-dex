/**
 * Format a number as USD currency
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a token amount with proper decimals
 */
export function formatTokenAmount(
  amount: number,
  decimals: number = 6
): string {
  return (amount / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Shorten a public key for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Calculate price impact percentage
 */
export function calculatePriceImpact(
  amountIn: number,
  amountOut: number,
  reserveIn: number,
  reserveOut: number
): number {
  const spotPrice = reserveOut / reserveIn;
  const executionPrice = amountOut / amountIn;
  return Math.abs((spotPrice - executionPrice) / spotPrice) * 100;
}
