import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Serve static files from frontend build in production
  if (process.env.NODE_ENV === 'production') {
    app.useStaticAssets(join(__dirname, '..', 'frontend', 'build'));

    // Serve React app for all non-API routes
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/webrtc')) {
        res.sendFile(join(__dirname, '..', 'frontend', 'build', 'index.html'));
      } else {
        next();
      }
    });
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}
bootstrap();
