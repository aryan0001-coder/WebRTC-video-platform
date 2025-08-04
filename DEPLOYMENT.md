# WebRTC Video Platform - Deployment Guide

## Overview

This is a full-stack WebRTC video calling platform with:

- **Backend**: NestJS with mediasoup for SFU (Selective Forwarding Unit)
- **Frontend**: React with TypeScript
- **Real-time Communication**: WebRTC via Socket.IO

## Deployment Options

### 1. Render.com (Recommended)

#### Prerequisites

- Render.com account
- Git repository with your code

#### Steps

1. **Connect Repository**
   - Go to Render.com dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings**
   - **Name**: `webrtc-video-platform`
   - **Environment**: `Node`
   - **Build Command**: `npm run install:all && npm run build`
   - **Start Command**: `npm run start:prod`

3. **Environment Variables**

   ```
   NODE_ENV=production
   PORT=3000
   MEDIASOUP_ANNOUNCED_IP=your-render-domain.onrender.com
   RECORDINGS_PATH=./recordings
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete

### 2. Railway.app

#### Steps

1. Connect your GitHub repository
2. Set build command: `npm run install:all && npm run build`
3. Set start command: `npm run start:prod`
4. Add environment variables as above

### 3. Heroku

#### Steps

1. Install Heroku CLI
2. Create `Procfile`:
   ```
   web: npm run start:prod
   ```
3. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set NODE_ENV=production
   heroku config:set MEDIASOUP_ANNOUNCED_IP=your-app-name.herokuapp.com
   git push heroku main
   ```

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install all dependencies
npm run install:all

# Start development server
npm run start:dev

# In another terminal, start frontend
cd frontend
npm start
```

### Environment Variables

Create `.env` file:

```env
NODE_ENV=development
PORT=3000
MEDIASOUP_ANNOUNCED_IP=localhost
RECORDINGS_PATH=./recordings
```

## Build Process

The build process includes:

1. **Backend Build**: Compiles NestJS TypeScript to JavaScript
2. **Frontend Build**: Compiles React app to static files
3. **Static File Serving**: Backend serves frontend files in production

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   WebRTC        │
│   (React)       │◄──►│   (NestJS)      │◄──►│   (mediasoup)   │
│                 │    │                 │    │                 │
│ - Video UI      │    │ - Socket.IO     │    │ - SFU Server    │
│ - Audio/Video   │    │ - Room Mgmt     │    │ - Stream Relay  │
│ - Controls      │    │ - Recording     │    │ - Codec Support │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Features

- ✅ Real-time video/audio calling
- ✅ Multiple participants support
- ✅ Screen sharing capability
- ✅ Recording functionality
- ✅ Modern UI with controls
- ✅ Responsive design
- ✅ WebRTC SFU architecture

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Ensure Node.js version is 18+
   - Check all dependencies are installed
   - Verify TypeScript compilation

2. **Audio Not Working**
   - Check browser permissions
   - Verify microphone access
   - Test with different browsers

3. **Video Not Working**
   - Check camera permissions
   - Verify HTTPS in production
   - Test with different devices

4. **Connection Issues**
   - Check WebRTC server configuration
   - Verify STUN/TURN servers
   - Check firewall settings

### Debug Commands

```bash
# Check build status
npm run build

# Test backend only
npm run start:dev

# Test frontend only
cd frontend && npm start

# Check logs
npm run start:prod
```

## Security Considerations

- Use HTTPS in production
- Implement proper authentication
- Secure WebRTC connections
- Validate user inputs
- Rate limiting for API endpoints

## Performance Optimization

- Enable gzip compression
- Use CDN for static assets
- Optimize WebRTC bitrates
- Implement connection pooling
- Monitor resource usage
