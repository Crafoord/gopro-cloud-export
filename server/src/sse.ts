import { Response } from 'express';
import { SSEPayload } from './types';

class SSEManager {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(payload: SSEPayload): void {
    const line = `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`;
    for (const client of this.clients) {
      client.write(line);
    }
  }

  get count(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
