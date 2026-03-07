import process from 'node:process';
import { JSONRPCMessageSchema, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export type StdioFraming = 'content-length' | 'newline';

function deserializeMessage(raw: string): JSONRPCMessage {
  return JSONRPCMessageSchema.parse(JSON.parse(raw));
}

function serializeNewlineMessage(message: JSONRPCMessage): string {
  return `${JSON.stringify(message)}\n`;
}

function serializeContentLengthMessage(message: JSONRPCMessage): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function findHeaderEnd(buffer: Buffer): { index: number; separatorLength: number } | null {
  const crlfEnd = buffer.indexOf('\r\n\r\n');
  if (crlfEnd !== -1) {
    return { index: crlfEnd, separatorLength: 4 };
  }

  const lfEnd = buffer.indexOf('\n\n');
  if (lfEnd !== -1) {
    return { index: lfEnd, separatorLength: 2 };
  }

  return null;
}

function looksLikeContentLength(buffer: Buffer): boolean {
  const probe = buffer.toString('utf8', 0, Math.min(buffer.length, 32));
  return /^content-length\s*:/i.test(probe) || 'content-length'.startsWith(probe.toLowerCase());
}

export class CompatibleStdioServerTransport {
  private _readBuffer: Buffer | undefined;
  private _started = false;
  private _framing: StdioFraming | null = null;

  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(
    private readonly _stdin: NodeJS.ReadStream = process.stdin,
    private readonly _stdout: NodeJS.WriteStream = process.stdout,
  ) {}

  private readonly _ondata = (chunk: Buffer) => {
    this._readBuffer = this._readBuffer ? Buffer.concat([this._readBuffer, chunk]) : chunk;
    this.processReadBuffer();
  };

  private readonly _onerror = (error: Error) => {
    this.onerror?.(error);
  };

  async start() {
    if (this._started) {
      throw new Error('CompatibleStdioServerTransport already started!');
    }

    this._started = true;
    this._stdin.on('data', this._ondata);
    this._stdin.on('error', this._onerror);
  }

  private detectFraming(): StdioFraming | null {
    if (!this._readBuffer || this._readBuffer.length === 0) {
      return null;
    }

    const firstByte = this._readBuffer[0];
    if (firstByte === 0x7b || firstByte === 0x5b) {
      return 'newline';
    }

    if (looksLikeContentLength(this._readBuffer)) {
      return 'content-length';
    }

    return null;
  }

  private readContentLengthMessage(): JSONRPCMessage | null {
    if (!this._readBuffer) {
      return null;
    }

    const header = findHeaderEnd(this._readBuffer);
    if (header === null) {
      return null;
    }

    const headerText = this._readBuffer
      .toString('utf8', 0, header.index)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const match = headerText.match(/(?:^|\n)content-length\s*:\s*(\d+)/i);
    if (!match) {
      throw new Error('Missing Content-Length header from MCP client');
    }

    const contentLength = Number.parseInt(match[1], 10);
    const bodyStart = header.index + header.separatorLength;
    const bodyEnd = bodyStart + contentLength;
    if (this._readBuffer.length < bodyEnd) {
      return null;
    }

    const body = this._readBuffer.toString('utf8', bodyStart, bodyEnd);
    this._readBuffer = this._readBuffer.subarray(bodyEnd);
    return deserializeMessage(body);
  }

  private readNewlineMessage(): JSONRPCMessage | null {
    if (!this._readBuffer) {
      return null;
    }

    const newlineIndex = this._readBuffer.indexOf('\n');
    if (newlineIndex === -1) {
      return null;
    }

    const line = this._readBuffer.toString('utf8', 0, newlineIndex).replace(/\r$/, '');
    this._readBuffer = this._readBuffer.subarray(newlineIndex + 1);
    if (line.trim().length === 0) {
      return this.readNewlineMessage();
    }

    return deserializeMessage(line);
  }

  private readMessage(): JSONRPCMessage | null {
    if (!this._readBuffer || this._readBuffer.length === 0) {
      return null;
    }

    if (this._framing === null) {
      this._framing = this.detectFraming();
      if (this._framing === null) {
        return null;
      }
    }

    return this._framing === 'content-length'
      ? this.readContentLengthMessage()
      : this.readNewlineMessage();
  }

  private processReadBuffer() {
    while (true) {
      try {
        const message = this.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }
  }

  async close() {
    this._stdin.off('data', this._ondata);
    this._stdin.off('error', this._onerror);

    const remainingDataListeners = this._stdin.listenerCount('data');
    if (remainingDataListeners === 0) {
      this._stdin.pause();
    }

    this._readBuffer = undefined;
    this.onclose?.();
  }

  send(message: JSONRPCMessage) {
    return new Promise<void>((resolve) => {
      const payload = this._framing === 'newline'
        ? serializeNewlineMessage(message)
        : serializeContentLengthMessage(message);

      if (this._stdout.write(payload)) {
        resolve();
      } else {
        this._stdout.once('drain', resolve);
      }
    });
  }
}
