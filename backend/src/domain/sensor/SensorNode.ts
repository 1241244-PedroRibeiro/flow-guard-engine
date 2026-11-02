import { randomUUID } from 'node:crypto';
import { DomainInvariantException } from '../common/exceptions';
import { SensorSerialNumber } from '../common/SensorSerialNumber';
import { SensorType, SENSOR_TYPES } from './SensorType';
import { ThresholdRule } from './ThresholdRule';

/**
 * SensorNode — Aggregate Root (KB §10.1).
 * ThresholdRule é Entity owned (at most 1 ativa).
 */
export class SensorNode {
    private constructor(
        private readonly id: string,
        private readonly lineId: string,
        private readonly serialNumber: SensorSerialNumber,
        private readonly sensorType: SensorType,
        private isActive: boolean,
        private lastCalibratedAt: Date | null,
        private readonly createdAt: Date,
        private updatedAt: Date,
        private readonly thresholdRule: ThresholdRule | null,
    ) {}

    static register(
        lineId: string,
        serialNumber: SensorSerialNumber,
        sensorType: SensorType,
    ): SensorNode {
        if (!lineId || lineId.trim().length === 0) {
            throw new DomainInvariantException('SensorNode.lineId is required.');
        }
        if (!SENSOR_TYPES.includes(sensorType)) {
            throw new DomainInvariantException(`Invalid SensorType: '${sensorType}'.`);
        }
        const now = new Date();
        return new SensorNode(
            randomUUID(),
            lineId,
            serialNumber,
            sensorType,
            true,
            null,
            now,
            now,
            null,
        );
    }

    static reconstitute(
        id: string,
        lineId: string,
        serialNumber: SensorSerialNumber,
        sensorType: SensorType,
        isActive: boolean,
        lastCalibratedAt: Date | null,
        createdAt: Date,
        updatedAt: Date,
        thresholdRule: ThresholdRule | null,
    ): SensorNode {
        return new SensorNode(
            id, lineId, serialNumber, sensorType, isActive,
            lastCalibratedAt, createdAt, updatedAt, thresholdRule,
        );
    }

    deactivate(): void {
        if (!this.isActive) {
            throw new DomainInvariantException('SensorNode is already inactive.');
        }
        this.isActive = false;
        this.touch();
    }

    activate(): void {
        if (this.isActive) {
            throw new DomainInvariantException('SensorNode is already active.');
        }
        this.isActive = true;
        this.touch();
    }

    calibrate(): void {
        this.lastCalibratedAt = new Date();
        this.touch();
    }

    private touch(): void {
        this.updatedAt = new Date();
    }

    getId(): string { return this.id; }
    getLineId(): string { return this.lineId; }
    getSerialNumber(): SensorSerialNumber { return this.serialNumber; }
    getSensorType(): SensorType { return this.sensorType; }
    getIsActive(): boolean { return this.isActive; }
    getLastCalibratedAt(): Date | null { return this.lastCalibratedAt; }
    getCreatedAt(): Date { return this.createdAt; }
    getUpdatedAt(): Date { return this.updatedAt; }
    getThresholdRule(): ThresholdRule | null { return this.thresholdRule; }
}