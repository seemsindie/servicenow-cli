/**
 * Bayeux / CometD message shapes used by ServiceNow's AMB endpoint.
 * Only the fields we read or write are listed.
 */

export interface BayeuxMessage {
  channel: string;
  clientId?: string;
  id?: string;
  successful?: boolean;
  error?: string;
  /** Present on /meta/handshake responses. */
  supportedConnectionTypes?: string[];
  /** Set on /meta/subscribe requests. */
  subscription?: string;
  /** Set on /meta/connect requests. */
  connectionType?: string;
  /** Set on /meta/handshake requests. */
  version?: string;
  /** Event payload (for non-/meta/* messages). */
  data?: unknown;
  /** SN-specific advice field (hold times, reconnect policy). */
  advice?: {
    timeout?: number;
    interval?: number;
    reconnect?: "retry" | "handshake" | "none";
  };
}

/** An event emitted by the server on a subscribed channel. */
export interface AmbEvent {
  channel: string;
  data: unknown;
  id?: string;
}
