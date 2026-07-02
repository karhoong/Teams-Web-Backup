import { WebContents } from "electron";
import { ExportStore } from "./exportStore";
import { NetworkEventRecord } from "../shared/types";

export class NetworkCapture {
  private attached = false;

  constructor(private webContents: WebContents, private getStore: () => ExportStore | null) {}

  start(): void {
    if (this.attached) return;
    try {
      this.webContents.debugger.attach("1.3");
      this.attached = true;
      void this.webContents.debugger.sendCommand("Network.enable");
      this.webContents.debugger.on("message", (_event, method, params) => {
        if (method !== "Network.responseReceived") return;
        void this.captureResponse(params as {
          requestId: string;
          response: { url: string; status: number; mimeType: string };
          type: string;
        });
      });
    } catch {
      this.attached = false;
    }
  }

  stop(): void {
    if (!this.attached) return;
    try {
      this.webContents.debugger.detach();
    } catch {
      // Best effort diagnostic capture only.
    }
    this.attached = false;
  }

  private async captureResponse(params: { requestId: string; response: { url: string; status: number; mimeType: string } }): Promise<void> {
    const store = this.getStore();
    if (!store || !this.isInteresting(params.response.url, params.response.mimeType)) return;

    const record: NetworkEventRecord = {
      capturedAt: new Date().toISOString(),
      url: params.response.url,
      status: params.response.status,
      mimeType: params.response.mimeType
    };

    try {
      const body = await this.webContents.debugger.sendCommand("Network.getResponseBody", { requestId: params.requestId }) as { body?: string; base64Encoded?: boolean };
      if (body.body && !body.base64Encoded) {
        record.body = JSON.parse(body.body);
      }
    } catch (error) {
      record.bodyError = error instanceof Error ? error.message : String(error);
    }

    store.appendNetworkEvent(record);
  }

  private isInteresting(url: string, mimeType: string): boolean {
    if (!mimeType.includes("json")) return false;
    return /teams|skype|chat|message|thread/i.test(url);
  }
}
