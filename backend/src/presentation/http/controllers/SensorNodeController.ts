import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { RolesGuard } from '../guards/RolesGuard';
import { Roles } from '../middlewares/decorators';
import { SensorManagementService } from '../../../application/sensor/SensorManagementService';
import { CreateSensorNodeCommand } from '../../../application/sensor/dto/CreateSensorNodeCommand';
import { UpsertThresholdRuleCommand } from '../../../application/sensor/dto/UpsertThresholdRuleCommand';
import {
    SensorNodeResponseDto,
    ThresholdRuleResponseDto,
} from '../../../application/sensor/dto/SensorNodeResponseDto';
import { SensorFilter } from '../../../application/sensor/ports/ISensorTelemetryRepository';
import { SensorType } from '../../../domain/sensor/SensorType';
import { UserRole } from '../../../domain/user/UserRole';

@Controller('sensor-nodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SensorNodeController {
    constructor(private readonly sensorManagementService: SensorManagementService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
    async createSensorNode(
        @Body() dto: CreateSensorNodeCommand,
    ): Promise<SensorNodeResponseDto> {
        return this.sensorManagementService.registerSensor(dto);
    }

    @Get()
    @Roles(UserRole.OPERATOR, UserRole.ENGINEER, UserRole.ADMINISTRATOR)
    async listSensorNodes(
        @Query('lineId') lineId?: string,
        @Query('sensorType') sensorType?: SensorType,
        @Query('isActive') isActive?: string,
    ): Promise<SensorNodeResponseDto[]> {
        const filter: SensorFilter = {
            lineId,
            sensorType,
            isActive: isActive === undefined ? undefined : isActive === 'true',
        };
        return this.sensorManagementService.listSensors(filter);
    }

    @Put(':id/threshold-rule')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
    async upsertThresholdRule(
        @Param('id') id: string,
        @Body() dto: UpsertThresholdRuleCommand,
    ): Promise<ThresholdRuleResponseDto> {
        return this.sensorManagementService.upsertThresholdRule(id, dto);
    }

    @Patch(':id/deactivate')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
    async deactivateSensor(@Param('id') id: string): Promise<SensorNodeResponseDto> {
        return this.sensorManagementService.deactivateSensor(id);
    }
}