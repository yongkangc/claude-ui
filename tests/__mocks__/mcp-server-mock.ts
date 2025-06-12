// Mock for @modelcontextprotocol/sdk/server/index.js
export class Server {
  constructor(public info: any, public requestHandlers: any) {}

  setRequestHandler(method: string, handler: any) {
    this.requestHandlers[method] = handler;
  }

  request(params: any) {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }

  connect(transport: any) {
    return Promise.resolve();
  }
}

export const CallToolResultSchema = {
  parse: (data: any) => data
};

export const ListToolsResultSchema = {
  parse: (data: any) => data
};