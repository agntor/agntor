import type { SimulationResult } from './schemas.js';

/**
 * Options for configuring the transaction simulator.
 */
export interface SimulatorConfig {
  /** RPC endpoint used for `eth_call`-style dry runs. */
  rpcUrl: string;

  /** Maximum gas allowed for a simulated transaction (default: 1 000 000). */
  maxGas?: number;

  /** Request timeout in milliseconds (default: 15 000). */
  timeout?: number;
}

/**
 * Parameters describing the transaction to simulate.
 */
export interface SimulationParams {
  /** Sender address. */
  from: string;

  /** Recipient / contract address. */
  to: string;

  /** ABI-encoded calldata. */
  data?: string;

  /** Value in wei (hex-encoded). */
  value?: string;

  /** Gas limit override (hex-encoded). */
  gas?: string;
}

const DEFAULT_MAX_GAS = 1_000_000;
const DEFAULT_TIMEOUT = 15_000;

/**
 * Transaction Simulator
 *
 * Performs a dry-run of an on-chain transaction via `eth_call` to
 * surface reverts, excessive gas usage, or other red flags before
 * the transaction is signed and broadcast.
 */
export class TransactionSimulator {
  private readonly rpcUrl: string;
  private readonly maxGas: number;
  private readonly timeout: number;

  constructor(config: SimulatorConfig) {
    if (!config.rpcUrl) {
      throw new Error('rpcUrl is required for TransactionSimulator');
    }
    this.rpcUrl = config.rpcUrl;
    this.maxGas = config.maxGas ?? DEFAULT_MAX_GAS;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Simulate a transaction using `eth_call` and `eth_estimateGas`.
   */
  async simulate(params: SimulationParams): Promise<SimulationResult> {
    const txObject = Object.fromEntries(
      Object.entries({
        from: params.from,
        to: params.to,
        data: params.data,
        value: params.value,
        gas: params.gas,
      }).filter(([, v]) => v !== undefined),
    );

    try {
      // 1. eth_call — detect reverts
      const callResult = await this.rpcCall('eth_call', [txObject, 'latest']);
      if (callResult.error) {
        return {
          safe: false,
          error: `Simulation reverted: ${callResult.error.message ?? JSON.stringify(callResult.error)}`,
          warnings: ['Transaction will revert on-chain'],
        };
      }

      // 2. eth_estimateGas — check gas usage
      const gasResult = await this.rpcCall('eth_estimateGas', [txObject]);
      const gasEstimate = gasResult.result
        ? parseInt(gasResult.result as string, 16)
        : undefined;

      const warnings: string[] = [];

      if (gasEstimate && gasEstimate > this.maxGas) {
        warnings.push(
          `Gas estimate ${gasEstimate} exceeds limit ${this.maxGas}`,
        );
      }

      return {
        safe: warnings.length === 0,
        gasEstimate,
        warnings: warnings.length ? warnings : undefined,
      };
    } catch (err) {
      return {
        safe: false,
        error: `Simulation failed: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Low-level JSON-RPC helper.
   */
  private async rpcCall(
    method: string,
    params: unknown[],
  ): Promise<{ result?: unknown; error?: { message?: string } }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RPC HTTP ${response.status}`);
      }

      return (await response.json()) as {
        result?: unknown;
        error?: { message?: string };
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
