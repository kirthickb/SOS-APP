import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { SOSResponse } from "../types";

// IMPORTANT: Replace with your actual backend URL
const WS_URL = "http://10.201.132.18:8080/ws";

export type SOSCallback = (sos: SOSResponse) => void;

class SocketService {
  private client: Client | null = null;
  private callbacks: Set<SOSCallback> = new Set();
  private isConnected: boolean = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create STOMP client with SockJS
        this.client = new Client({
          webSocketFactory: () => new SockJS(WS_URL) as any,
          debug: (str) => {
            console.log("[STOMP]", str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        this.client.onConnect = () => {
          console.log("✅ WebSocket connected");
          this.isConnected = true;

          // Subscribe to SOS topic
          this.client?.subscribe("/topic/sos", (message: IMessage) => {
            try {
              const sosData: SOSResponse = JSON.parse(message.body);
              console.log("🚨 Received SOS:", sosData);

              // Notify all registered callbacks
              this.callbacks.forEach((callback) => callback(sosData));
            } catch (error) {
              console.error("Error parsing SOS message:", error);
            }
          });

          resolve();
        };

        this.client.onStompError = (frame) => {
          console.error("STOMP error:", frame);
          this.isConnected = false;
          reject(new Error("WebSocket connection failed"));
        };

        this.client.onWebSocketError = (event) => {
          console.error("WebSocket error:", event);
          this.isConnected = false;
        };

        this.client.onDisconnect = () => {
          console.log("❌ WebSocket disconnected");
          this.isConnected = false;
        };

        // Activate the client
        this.client.activate();
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.isConnected = false;
      this.callbacks.clear();
      console.log("🔌 WebSocket disconnected manually");
    }
  }

  subscribeToSOS(callback: SOSCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }
}

export default new SocketService();
