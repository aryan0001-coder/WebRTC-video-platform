#!/bin/bash

echo "🧪 Testing build process..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf frontend/build/

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build backend
echo "🔨 Building backend..."
npm run build:backend

# Build frontend
echo "🔨 Building frontend..."
npm run build:frontend

echo "✅ Build test completed!"
echo "📁 Backend build: dist/"
echo "📁 Frontend build: frontend/build/" 