import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { CompatibleStdioServerTransport } from '../../src/mcp/compatible-stdio-transport.js';

function onceMessage(transport: CompatibleStdioServerTransport): Promise<any> {
  return new Promise((resolve, reject) => {
    transport.onmessage = (message) => resolve(message);
    transport.onerror = (error) => reject(error);
  });
}

describe('CompatibleStdioServerTransport', () => {
  let stdin: PassThrough;
  let stdout: PassThrough;
  let transport: CompatibleStdioServerTransport;

  beforeEach(() => {
    stdin = new PassThrough();
    stdout = new PassThrough();
    transport = new CompatibleStdioServerTransport(stdin, stdout);
  });

  it('parses Content-Length framed initialize requests', async () => {
    await transport.start();
    const messagePromise = onceMessage(transport);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'codex', version: '0.1' },
      },
    });

    stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);

    await expect(messagePromise).resolves.toMatchObject({
      method: 'initialize',
      params: { clientInfo: { name: 'codex' } },
    });
  });

  it('parses newline-delimited initialize requests', async () => {
    await transport.start();
    const messagePromise = onceMessage(transport);
    stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cursor', version: '0.1' },
      },
    })}\n`);

    await expect(messagePromise).resolves.toMatchObject({
      method: 'initialize',
      params: { clientInfo: { name: 'cursor' } },
    });
  });

  it('responds with Content-Length framing after Content-Length input', async () => {
    await transport.start();
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'codex', version: '0.1' },
      },
    });

    const messagePromise = onceMessage(transport);
    stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\n\n${body}`);
    await messagePromise;

    const chunks: Buffer[] = [];
    stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    await transport.send({ jsonrpc: '2.0', id: 1, result: { ok: true } });
    const raw = Buffer.concat(chunks).toString('utf8');

    expect(raw).toMatch(/^Content-Length: \d+\r\n\r\n/);
    expect(raw).toContain('"ok":true');
  });

  it('responds with newline framing after newline input', async () => {
    await transport.start();
    const messagePromise = onceMessage(transport);
    stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cursor', version: '0.1' },
      },
    })}\n`);
    await messagePromise;

    const chunks: Buffer[] = [];
    stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    await transport.send({ jsonrpc: '2.0', id: 1, result: { ok: true } });
    const raw = Buffer.concat(chunks).toString('utf8');

    expect(raw).toBe('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n');
  });
});
