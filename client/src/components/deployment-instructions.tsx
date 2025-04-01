import React from 'react';

export default function DeploymentInstructions() {
  return (
    <div className="text-white font-mono">
      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-blue-400">Deployment Instructions</h3>
        <div className="bg-gray-900 p-4 rounded-md">
          <pre className="text-sm text-green-400 whitespace-pre-wrap">
{`# Deployment Sequence for SmartContract System

## Transaction Sequence
This section outlines the recommended sequence of contract deployment and initialization to ensure proper system setup.

1. **Deploy Libraries First**
   - \`SafeMath.sol\` → 0x1234...5678
   - \`StringUtils.sol\` → 0x8765...4321
   - Gas cost: ~450,000 gas (total for all libraries)

2. **Deploy Core Contracts**
   - \`MarketFactory.sol\` → 0xabcd...ef01
   - \`TokenRegistry.sol\` → 0x2345...6789
   - \`OracleManager.sol\` → 0x9876...5432
   - Gas cost: ~1,850,000 gas (total for core contracts)

3. **Deploy Implementation Contracts**
   - \`ManualResolutionStrategy.sol\` → 0xfedc...ba98
   - \`AutomatedMarketMaker.sol\` → 0x3456...7890
   - Gas cost: ~1,200,000 gas (total for implementations)

4. **Initialize System**
   - Call \`MarketFactory.initialize(tokenRegistry, oracleManager)\`
   - Call \`TokenRegistry.registerStablecoin("USDC", "0x1234...5678")\`
   - Call \`OracleManager.setDefaultFeed("ETH/USD", "0x5678...9abc")\`
   - Gas cost: ~650,000 gas (for initialization calls)

## Total Gas Requirements
- Estimated deployment cost: ~4,150,000 gas
- At 50 gwei: ~0.2075 ETH (~$415 at $2,000/ETH)

## Network Recommendations
- **Mainnet**: Deploy during low gas periods (weekends, early mornings UTC)
- **L2 Solution**: Consider Arbitrum or Optimism for 10-100x lower fees
- **Test First**: Deploy to Sepolia or Goerli testnet to validate sequence

## Post-Deployment Verification
1. Verify all contracts on Etherscan
2. Run the verification script: \`npx hardhat verify:all --network mainnet\`
3. Test initial market creation with test parameters`}
          </pre>
        </div>
      </div>
    </div>
  );
}