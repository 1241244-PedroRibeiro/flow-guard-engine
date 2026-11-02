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
import { AnomalyAlertService } from '../../../application/alert/AnomalyAlertService';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { RolesGuard } from '../guards/RolesGuard';
import { Roles, CurrentUser } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';
import { JoiValidationPipe } from '../pipes/JoiValidationPipe';
import { AlertStatus } from '../../../domain/alert/AlertStatus';
import { AlertSeverity } from '../../../domain/alert/AlertSeverity';

const querySchema = Joi.object({
  status: Joi.string().valid(...Object.values(AlertStatus)).optional(),
  severity: Joi.string().valid(...Object.values(AlertSeverity)).optional(),
  lineId: Joi.string().uuid({ version: 'uuidv4' }).optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
}).required();

const ackBodySchema = Joi.object({
  diagnosticNote: Joi.string().trim().min(3).max(500).required(),
}).required();

@Controller('anomaly-alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnomalyAlertController {
  constructor(private readonly service: AnomalyAlertService) {}

  @Get()
  @Roles(UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async list(@Query(new JoiValidationPipe(querySchema)) query: any) {
    return this.service.getAlerts({
      status: query.status,
      severity: query.severity,
      lineId: query.lineId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async acknowledge(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(ackBodySchema)) body: { diagnosticNote: string },
    @CurrentUser() user: any,
  ) {
    return this.service.acknowledgeAlert({
      alertId: id,
      userId: user.sub,
      diagnosticNote: body.diagnosticNote,
    });
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async resolve(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.resolveAlert(id);
  }
}