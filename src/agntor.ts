import { createHash } from 'crypto';
import type {
  AgntorConfig,
  AgntorEvent,
  AgntorEventCallback,
  AgentIdentity,
  VerificationStatus,
  AttestationParams,
  EscrowCreateParams,
  EscrowRecord,
  SettlementResult,
  ReputationScore,
  ReputationHistoryEntry,
} from './types.js';
import { AgntorError } from './types.js';

const DEFAULT_BASE_URL = 'https://api.agntor.com';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Agntor SDK — Trust & payment rail for agents.
 *
 * Modules: identity · verify · escrow · settle · reputation
 */
export class Agntor {
  private readonly apiKey: string;
  private readonly agentId: string;
  private readonly chain: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly listeners = new Map<AgntorEvent, Set<AgntorEventCallback>>();

  /** Identity module */
  public readonly identity: IdentityModule;
  /** Verification module */
  public readonly verify: VerifyModule;
  /** Escrow module */
  public readonly escrow: EscrowModule;
  /** Settlement module */
  public readonly settle: SettleModule;
  /** Reputation module */
  public readonly reputation: ReputationModule;

  constructor(config: AgntorConfig) {
    if (!config.apiKey) {
      throw new AgntorError('apiKey is required', 'MISSING_API_KEY');
    }
    if (!config.agentId) {
      throw new AgntorError('agentId is required', 'MISSING_AGENT_ID');
    }
    if (!config.chain) {
      throw new AgntorError('chain is required', 'MISSING_CHAIN');
    }

    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
    this.chain = config.chain;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

    // Bind sub-modules
    this.identity = new IdentityModule(this);
    this.verify = new VerifyModule(this);
    this.escrow = new EscrowModule(this);
    this.settle = new SettleModule(this);
    this.reputation = new ReputationModule(this);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on(event: AgntorEvent, callback: AgntorEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: AgntorEvent, callback: AgntorEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  /** @internal */
  emit(event: AgntorEvent, data: unknown): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        cb(data);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP transport (internal)
  // ---------------------------------------------------------------------------

  /** @internal */
  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'x-agent-id': this.agentId,
      'x-chain': this.chain,
      ...(options.headers as Record<string, string> | undefined),
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.status === 402) {
          const data = await response.json();
          return data as T;
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new AgntorError(
            `Agntor API error: ${response.status} ${response.statusText}${body ? ` – ${body}` : ''}`,
            'API_ERROR',
            response.status,
          );
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err as Error;

        // Don't retry client errors (4xx) or abort errors
        if (err instanceof AgntorError && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
          throw err;
        }

        if ((err as Error).name === 'AbortError') {
          throw new AgntorError(
            `Request to ${path} timed out after ${this.timeout}ms`,
            'TIMEOUT',
          );
        }

        // Retry on transient failures
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 200));
        }
      }
    }

    throw lastError ?? new AgntorError('Request failed', 'UNKNOWN');
  }

  // ---------------------------------------------------------------------------
  // Legacy convenience methods (kept for MCP server compatibility)
  // ---------------------------------------------------------------------------

  /** @internal */
  async getAgent(idOrHandle: string) {
    return this.request<Record<string, unknown>>(`/api/v1/agents/${idOrHandle}`);
  }

  /** @internal */
  async getScore(handle: string) {
    const data = await this.getAgent(handle);
    return (data as Record<string, Record<string, unknown>>).trust?.score;
  }

  /** @internal */
  async activateKillSwitch(agentId: string, reason: string) {
    return this.request('/api/v1/agents/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ agentId, reason }),
    });
  }

  /** @internal */
  async queryAgents(params: Record<string, unknown>) {
    return this.request('/api/v1/agents', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /** @internal – legacy escrow helper used by MCP */
  async createEscrowLegacy(params: { target: string; amount: number; task: string; agentId?: string }) {
    return this.request('/api/escrow/create', {
      method: 'POST',
      body: JSON.stringify({
        agentId: params.agentId ?? this.agentId,
        workerWallet: params.target,
        amount: params.amount,
        taskDescription: params.task,
      }),
    });
  }

  /** @internal – legacy verify helper used by MCP */
  async verifyLegacy(agentId?: string) {
    const hash = createHash('sha256').update(Date.now().toString()).digest('hex');
    const body: Record<string, unknown> = { hash };
    if (agentId) body.agentId = agentId;
    return this.request('/api/v1/agents/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

// ---------------------------------------------------------------------------
// Sub-modules
// ---------------------------------------------------------------------------

class IdentityModule {
  constructor(private sdk: Agntor) {}

  /** Register the current agent's identity */
  async register(): Promise<AgentIdentity> {
    return this.sdk.request<AgentIdentity>('/api/v1/identity/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Resolve another agent's identity */
  async resolve(agentId: string): Promise<AgentIdentity> {
    return this.sdk.request<AgentIdentity>(`/api/v1/identity/${encodeURIComponent(agentId)}`);
  }

  /** Get the current agent's identity */
  async me(): Promise<AgentIdentity> {
    return this.sdk.request<AgentIdentity>('/api/v1/identity/me');
  }
}

class VerifyModule {
  constructor(private sdk: Agntor) {}

  /** Get verification status for an agent */
  async status(agentId: string): Promise<VerificationStatus> {
    return this.sdk.request<VerificationStatus>(`/api/v1/verify/${encodeURIComponent(agentId)}`);
  }

  /** Submit an attestation */
  async attest(params: AttestationParams): Promise<VerificationStatus> {
    return this.sdk.request<VerificationStatus>('/api/v1/verify/attest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /** Get the current agent's badge */
  async badge(): Promise<{ badge: string }> {
    return this.sdk.request<{ badge: string }>('/api/v1/verify/badge');
  }
}

class EscrowModule {
  constructor(private sdk: Agntor) {}

  /** Create a new escrow */
  async create(params: EscrowCreateParams): Promise<EscrowRecord> {
    const result = await this.sdk.request<EscrowRecord>('/api/v1/escrow/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.sdk.emit('escrow_created', result);
    return result;
  }

  /** Fund an existing escrow */
  async fund(escrowId: string): Promise<EscrowRecord> {
    const result = await this.sdk.request<EscrowRecord>(`/api/v1/escrow/${encodeURIComponent(escrowId)}/fund`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    this.sdk.emit('escrow_funded', result);
    return result;
  }

  /** Get escrow status */
  async status(escrowId: string): Promise<EscrowRecord> {
    return this.sdk.request<EscrowRecord>(`/api/v1/escrow/${encodeURIComponent(escrowId)}`);
  }

  /** Cancel an escrow */
  async cancel(escrowId: string): Promise<EscrowRecord> {
    const result = await this.sdk.request<EscrowRecord>(`/api/v1/escrow/${encodeURIComponent(escrowId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    this.sdk.emit('escrow_cancelled', result);
    return result;
  }
}

class SettleModule {
  constructor(private sdk: Agntor) {}

  /** Release escrowed funds to the counterparty */
  async release(escrowId: string): Promise<SettlementResult> {
    const result = await this.sdk.request<SettlementResult>(`/api/v1/settle/${encodeURIComponent(escrowId)}/release`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    this.sdk.emit('escrow_settled', result);
    return result;
  }

  /** Slash – return funds to the originator */
  async slash(escrowId: string): Promise<SettlementResult> {
    const result = await this.sdk.request<SettlementResult>(`/api/v1/settle/${encodeURIComponent(escrowId)}/slash`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    this.sdk.emit('escrow_settled', result);
    return result;
  }

  /** Resolve with proof */
  async resolve(escrowId: string, proof: string): Promise<SettlementResult> {
    const result = await this.sdk.request<SettlementResult>(`/api/v1/settle/${encodeURIComponent(escrowId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ proof }),
    });
    this.sdk.emit('escrow_settled', result);
    return result;
  }
}

class ReputationModule {
  constructor(private sdk: Agntor) {}

  /** Get reputation score for an agent */
  async get(agentId: string): Promise<ReputationScore> {
    return this.sdk.request<ReputationScore>(`/api/v1/reputation/${encodeURIComponent(agentId)}`);
  }

  /** Get reputation history for an agent */
  async history(agentId: string): Promise<ReputationHistoryEntry[]> {
    return this.sdk.request<ReputationHistoryEntry[]>(`/api/v1/reputation/${encodeURIComponent(agentId)}/history`);
  }
}
