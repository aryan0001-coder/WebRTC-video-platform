export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfiguration {
  iceServers: IceServer[];
  iceTransportPolicy?: 'all' | 'relay';
  bundlePolicy?: 'balanced' | 'max-bundle' | 'max-compat';
  rtcpMuxPolicy?: 'negotiate' | 'require';
}

// Default ICE configuration with public STUN servers
export const defaultIceConfiguration: IceConfiguration = {
  iceServers: [
    // Google's public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // Cloudflare STUN servers
    { urls: 'stun:stun.cloudflare.com:3478' },

    // Add TURN servers if you have them (for production use)
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'your-turn-username',
    //   credential: 'your-turn-password'
    // },
    // {
    //   urls: 'turns:your-turn-server.com:5349',
    //   username: 'your-turn-username',
    //   credential: 'your-turn-password'
    // }
  ],
  iceTransportPolicy: 'all', // Use both STUN and TURN
  bundlePolicy: 'max-bundle', // Bundle all media streams
  rtcpMuxPolicy: 'require', // Multiplex RTP and RTCP
};

// Production ICE configuration with custom TURN servers
export const productionIceConfiguration: IceConfiguration = {
  iceServers: [
    // Keep STUN servers as fallback
    { urls: 'stun:stun.l.google.com:19302' },

    // Add your TURN servers here
    {
      urls: [
        'turn:' +
          (process.env.TURN_SERVER_HOST || 'turn.example.com') +
          ':3478',
        'turns:' +
          (process.env.TURN_SERVER_HOST || 'turn.example.com') +
          ':5349',
      ],
      username: process.env.TURN_USERNAME || 'username',
      credential: process.env.TURN_PASSWORD || 'password',
    },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Get ICE configuration based on environment
export function getIceConfiguration(): IceConfiguration {
  const useProduction =
    process.env.NODE_ENV === 'production' && process.env.TURN_SERVER_HOST;

  return useProduction ? productionIceConfiguration : defaultIceConfiguration;
}
