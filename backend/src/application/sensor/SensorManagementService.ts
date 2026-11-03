import {
    EntityNotFoundException,
    ResourceConflictException,
} from '../../domain/common/exceptions';
import { SensorSerialNumber } from '../../domain/common/SensorSerialNumber';
import { TelemetryValue } from '../../domain/common/TelemetryValue';
import { SensorNode } from '../../domain/sensor/SensorNode';
import { ThresholdRule } from '../../domain/sensor/ThresholdRule';
import { SensorType, SENSOR_TYPES } from '../../domain/sensor/SensorType';
import { CreateSensorNodeCommand } from './dto/CreateSensorNodeCommand';
import { SensorNodeResponseDto, ThresholdRuleResponseDto } from './dto/SensorNodeResponseDto';
import { UpsertThresholdRuleCommand } from './dto/UpsertThresholdRuleCommand';
import { ISensorTelemetryRepository, SensorFilter } from './ports/ISensorTelemetryRepository';

export class SensorManagementService {
    constructor(private readonly repository: ISensorTelemetryRepository) {}

    /** AC1 — Registo de SensorNode. */
    async registerSensor(command: CreateSensorNodeCommand): Promise<SensorNodeResponseDto> {
        const lineExists = await this.repository.lineExists(command.lineId);
        if (!lineExists) {
            throw new EntityNotFoundException(
                `ConveyorLine with id '${command.lineId}' does not exist.`,
            );
        }

        if (!SENSOR_TYPES.includes(command.sensorType)) {
            throw new EntityNotFoundException(`Invalid SensorType '${command.sensorType}'.`);
        }

        const serialNumber = SensorSerialNumber.create(command.serialNumber);

        // case-insensitive uniqueness (uq_sensor_nodes_serial_upper)
        const existing = await this.repository.findBySerialNumber(serialNumber.getValue());
        if (existing) {
            throw new ResourceConflictException(
                `SensorNode with serialNumber '${serialNumber.getValue()}' already exists.`,
            );
        }

        const sensor = SensorNode.register(command.lineId, serialNumber, command.sensorType);
        await this.repository.save(sensor);
        return this.toDto(sensor);
    }

    /** AC2 — Upsert de ThresholdRule com validação de invariantes (422). */
    async upsertThresholdRule(
        sensorId: string,
        command: UpsertThresholdRuleCommand,
    ): Promise<ThresholdRuleResponseDto> {
        const sensor = await this.repository.findById(sensorId);
        if (!sensor) {
            throw new EntityNotFoundException(`SensorNode with id '${sensorId}' not found.`);
        }

        const warningLimit = TelemetryValue.create(command.warningLimit, command.unit);
        const criticalLimit = TelemetryValue.create(command.criticalLimit, command.unit);

        const existingRule = sensor.getThresholdRule();
        let rule: ThresholdRule;

        // CORRECT: If a rule exists, update it; otherwise, create a new one. This ensures that the sensor always has a valid threshold rule.
        if (existingRule) {
            rule = existingRule.updateLimits(
                warningLimit,
                criticalLimit,
                command.windowSizeSamples,
            );
        } else {
            rule = ThresholdRule.create(
                sensorId,
                warningLimit,
                criticalLimit,
                command.windowSizeSamples,
            );
        }

        await this.repository.saveThresholdRule(rule);
        return this.toThresholdDto(rule);
    }

    /** AC3 — Listagem com filtros. */
    async listSensors(filter?: SensorFilter): Promise<SensorNodeResponseDto[]> {
        const sensors = await this.repository.findAll(filter);
        return sensors.map((s) => this.toDto(s));
    }

    /** AC4 — Soft deactivation. */
    async deactivateSensor(sensorId: string): Promise<SensorNodeResponseDto> {
        const sensor = await this.repository.findById(sensorId);
        if (!sensor) {
            throw new EntityNotFoundException(`SensorNode with id '${sensorId}' not found.`);
        }
        sensor.deactivate();
        await this.repository.save(sensor);
        return this.toDto(sensor);
    }

    private toDto(sensor: SensorNode): SensorNodeResponseDto {
        const rule = sensor.getThresholdRule();
        return {
            id: sensor.getId(),
            lineId: sensor.getLineId(),
            serialNumber: sensor.getSerialNumber().getValue(),
            sensorType: sensor.getSensorType(),
            isActive: sensor.getIsActive(),
            lastCalibratedAt: sensor.getLastCalibratedAt()?.toISOString() ?? null,
            createdAt: sensor.getCreatedAt().toISOString(),
            updatedAt: sensor.getUpdatedAt().toISOString(),
            thresholdRule: rule ? this.toThresholdDto(rule) : null,
        };
    }

    private toThresholdDto(rule: ThresholdRule): ThresholdRuleResponseDto {
        return {
            id: rule.getId(),
            sensorId: rule.getSensorId(),
            warningLimit: rule.getWarningLimit().getNumericValue(),
            criticalLimit: rule.getCriticalLimit().getNumericValue(),
            unit: rule.getCriticalLimit().getUnit(),
            windowSizeSamples: rule.getWindowSizeSamples(),
            version: rule.getVersion(),
        };
    }
}