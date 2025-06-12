// Mock for @modelcontextprotocol/sdk/server/stdio.js
export class StdioServerTransport {
  constructor() {}

  start() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }

  send(message: any) {
    return Promise.resolve();
  }
}