import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { clientTransport } from "./transport";

export const initMCPClient = async () => {
  const client = new Client(
    {
      name: "faust-web-ide-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  // Connect to the in-memory server via the linked transport
  await client.connect(clientTransport);
  return client;
};
