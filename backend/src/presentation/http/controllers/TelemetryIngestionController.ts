import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import Joi from 'joi';
import { TelemetryIngestionService } from '../../../application/sensor/TelemetryIngestionService';
import { IngestTelemetryReadingCommand } from '../../../application/sensor/dto/IngestTelemetryReadingCommand';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { RolesGuard } from '../guards/RolesGuard';
import { Roles } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';
import { JoiValidationPipe } from '../pipes/JoiValidationPipe';

/** Body schema (KB §20, requirements §1.2) — stripUnknown defense applied upstream. */
const ingestBodySchema = Joi.object({
  rawValue: Joi.number().required(),
  unit: Joi.string().trim().min(1).max(20).required(),
  recordedAt: Joi.string().isoDate().optional(),
}).required();

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
}).required();

@Controller('sensor-nodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TelemetryIngestionController {
  constructor(private readonly service: TelemetryIngestionService) {}

  @Post(':id/telemetry-readings')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async ingest(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(ingestBodySchema))
    body: Omit<IngestTelemetryReadingCommand, 'sensorId'>,
  ) {
    return this.service.ingest({ sensorId: id, ...body });
  }

  @Get(':id/telemetry-readings')
  @Roles(UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async list(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query(new JoiValidationPipe(listQuerySchema))
    query: { page: number; pageSize: number },
  ) {
    return this.service.listReadings({
      sensorId: id,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}