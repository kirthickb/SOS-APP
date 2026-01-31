import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { SOSResponse } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../config";

const TOKEN_KEY = "@sos_token";

export type SOSCallback = (sos: SOSResponse) => void;

class SocketService {
  private client: Client | null = null;
  private callbacks: Set<SOSCallback> = new Set();
  private isConnected: boolean = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get JWT token for authentication
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) {
          reject(new Error("No authentication token available"));
          return;
        }

        // Create STOMP client with SockJS
        this.client = new Client({
          brokerURL: undefined, // Use webSocketFactory instead
          webSocketFactory: () => {
            const url = new URL(API_CONFIG.SOCKET_URL);
            // Add token as query parameter (safer than header for SockJS)
            url.searchParams.append("token", token);
            return new SockJS(url.toString()) as any;
          },
          debug: (str) => {
            if (API_CONFIG.ENABLE_LOGGING) {
              console.log("[STOMP]", str);
            }
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          connectHeaders: {
            // Include token in STOMP CONNECT frame for better security
            Authorization: `Bearer ${token}`,
          },
        });

        this.client.onConnect = () => {
          console.log("✅ WebSocket connected");
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Subscribe to SOS topic (driver-specific)
          this.client?.subscribe("/topic/sos", (message: IMessage) => {
            try {
              const sosData: SOSResponse = JSON.parse(message.body);
              if (API_CONFIG.ENABLE_LOGGING) {
                console.log("🚨 Received SOS:", sosData);
              }

              // Notify all registered callbacks
              this.callbacks.forEach((callback) => callback(sosData));
            } catch (error) {
              console.error("Error parsing SOS message:", error);
            }
          });

          // Subscribe to user-specific channel for private messages
          const userId = this.extractUserIdFromToken(token);
          if (userId) {
            this.client?.subscribe(
              `/user/${userId}/topic/sos`,
              (message: IMessage) => {
                try {
                  const sosData: SOSResponse = JSON.parse(message.body);
                  if (API_CONFIG.ENABLE_LOGGING) {
                    console.log("📬 Received private SOS update:", sosData);
                  }
                  this.callbacks.forEach((callback) => callback(sosData));
                } catch (error) {
                  console.error("Error parsing private SOS message:", error);
                }
              }
            );
          }

          resolve();
        };

        this.client.onStompError = (frame) => {
          console.error("STOMP error:", frame);
          this.isConnected = false;
          reject(new Error("WebSocket connection failed: " + frame.body));
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

  /**
   * Extract user ID from JWT token (simple decoder, not validation)
   * In production, validate token on backend
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      // JWT format: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || payload.userId || null;
    } catch (error) {
      console.error("Error extracting user ID from token:", error);
      return null;
    }
  }
}

export default new SocketService();
