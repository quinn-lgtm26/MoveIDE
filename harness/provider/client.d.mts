import type { CoachPacket, CoachingImage, CoachingResponse } from '../coaching/index.mjs';

export interface ConnectionState {
  state: 'disconnected' | 'connecting' | 'connected' | 'denied' | 'unavailable';
  enabled?: false;
  revocationConfirmed?: boolean;
}

export const chatGPTProvider: {
  getConnection(signal?: AbortSignal): Promise<ConnectionState>;
  startConnection(): Promise<{ state: 'connecting'; authorizationUrl: string }>;
  cancelConnection(): Promise<ConnectionState>;
  disconnect(): Promise<ConnectionState>;
  listModels(signal?: AbortSignal): Promise<{ id: string; label: string }[]>;
  interpret(
    packet: CoachPacket,
    images: CoachingImage[],
    options: { model: string; signal?: AbortSignal },
  ): Promise<CoachingResponse>;
};
