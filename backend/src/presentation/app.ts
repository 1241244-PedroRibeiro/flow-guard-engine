import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './global_exception.filter';

/**
 * Creates and configures the NestJS application without binding to a live TCP port.
 * Enables in-memory HTTP integration testing with Supertest (KB §9.2, ADR-0007).
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });

  // Versioned REST API base path (ADR-0006)
  app.setGlobalPrefix('api/v1');

  // Strict CORS allowlist configuration (KB §9.4, ADR-0005)
  const allowedOriginsRaw =
    process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3000';
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Centralized RFC-compliant JSON exception filter (ADR-0006)
  app.useGlobalFilters(new GlobalExceptionFilter());

  return app;
}