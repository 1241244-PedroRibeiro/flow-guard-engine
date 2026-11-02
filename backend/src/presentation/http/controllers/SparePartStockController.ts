import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import Joi from 'joi';
import { SparePartsStockService } from '../../../application/stock/SparePartsStockService';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { RolesGuard } from '../guards/RolesGuard';
import { Roles, CurrentUser } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';
import { JoiValidationPipe } from '../pipes/JoiValidationPipe';

const createBodySchema = Joi.object({
  partCode: Joi.string().trim().min(3).max(30).required(),
  name: Joi.string().trim().min(3).max(150).required(),
  initialStockUnits: Joi.number().integer().min(0).required(),
}).required();

const adjustBodySchema = Joi.object({
  units: Joi.number().integer().min(1).required(),
  reason: Joi.string().trim().min(3).max(255).required(),
}).required();

@Controller('spare-parts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SparePartStockController {
  constructor(private readonly service: SparePartsStockService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async create(@Body(new JoiValidationPipe(createBodySchema)) body: any) {
    return this.service.register({
      partCode: body.partCode,
      name: body.name,
      initialStockUnits: body.initialStockUnits,
    });
  }

  @Get()
  @Roles(UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async list() {
    return this.service.listAll();
  }

  @Post(':id/replenish')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async replenish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(adjustBodySchema)) body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.replenish({
      partId: id,
      units: body.units,
      reason: body.reason,
      userId: user.sub,
    });
  }

  @Post(':id/consume')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async consume(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new JoiValidationPipe(adjustBodySchema)) body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.consume({
      partId: id,
      units: body.units,
      reason: body.reason,
      userId: user.sub,
    });
  }
}