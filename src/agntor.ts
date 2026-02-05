import { createHash } from 'crypto';

export class Agntor {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://agntor.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      ...(options.headers as Record<string, string>),
    };
    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    // We don't throw on 402
    if (!response.ok && response.status !== 402) {
        throw new Error(`Agntor API Error: ${response.status} ${response.statusText}`);
    }
    return response;
  }

  async verify(agentId?: string) {
    // Self-audit if no agentId provided (API determines identity from key)
    // Generate a simple hash (Proof of Work/Life)
    const hash = createHash('sha256').update(Date.now().toString()).digest('hex');
    
    const body: any = { hash };
    if (agentId) body.agentId = agentId;

    const res = await this.request('/api/v1/agents/verify', {
        method: 'POST',
        body: JSON.stringify(body)
    });
    return res.json();
  }

  async getAgent(idOrHandle: string) {
      const res = await this.request(`/api/v1/agents/${idOrHandle}`);
      return await res.json() as any;
  }

  async getScore(handle: string) {
      const res = await this.request(`/api/v1/agents/${handle}`);
      const data = await res.json() as any;
      return data.trust?.score;
  }

  async activateKillSwitch(agentId: string, reason: string) {
      const res = await this.request('/api/v1/agents/kill-switch', {
          method: 'POST',
          body: JSON.stringify({ agentId, reason })
      });
      return res.json();
  }

  async queryAgents(params: any) {
      const res = await this.request('/api/v1/agents', {
          method: 'POST', // using POST for complex query body
          body: JSON.stringify(params)
      });
      return res.json();
  }

  async escrow(params: { target: string; amount: number; task: string; agentId?: string }) {
      const res = await this.request('/api/escrow/create', {
          method: 'POST',
          body: JSON.stringify({
              agentId: params.agentId, // Optional, API infers from key if missing
              workerWallet: params.target,
              amount: params.amount,
              taskDescription: params.task
          })
      });
      
      const data = await res.json() as any;
      
      if (res.status === 402) {
          return {
              status: 'payment_required',
              details: data,
              headers: {
                  amount: res.headers.get('X-402-Amount'),
                  to: res.headers.get('X-402-To'),
                  taskId: res.headers.get('X-402-Task-ID')
              }
          };
      }
      
      return data;
  }
}
