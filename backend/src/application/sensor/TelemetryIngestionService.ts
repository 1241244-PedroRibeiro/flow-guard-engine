import { randomUUID } from 'node:crypto';
import { AlertSeverity } from '../../domain/alert/AlertSeverity';
import { AnomalyAlert } from '../../domain/alert/AnomalyAlert';
import { DomainInvariantException } from '../../domain/common/exceptions/DomainInvariantException';
import { EntityNotFoundException } from '../../domain/common/exceptions/EntityNotFoundException';
import { TelemetryEvaluationEngine } from '../../domain/sensor/TelemetryEvaluationEngine';
import { TelemetryReading } from '../../domain/sensor/TelemetryReading';
import { LineStatus } from '../../domain/topology/LineStatus';
import { IngestTelemetryReadingCommand } from './dto/IngestTelemetryReadingCommand';
import { TelemetryIngestionEvaluationResponseDto } from './dto/TelemetryIngestionEvaluationResponseDto';
import { QueryTelemetryReadingsQuery } from './dto/QueryTelemetryReadingsQuery';
import { PaginatedTelemetryReadingsResponseDto } from './dto/PaginatedTelemetryReadingsResponseDto';
import { ISensorTelemetryRepository } from './ports/ISensorTelemetryRepository';

export class TelemetryIngestionService {
  constructor(
    private readonly repo: ISensorTelemetryRepository,
    private readonly engine: TelemetryEvaluationEngine,
  ) {}

  async ingest(cmd: IngestTelemetryReadingCommand): Promise<TelemetryIngestionEvaluationResponseDto> {
    const ctx = await this.repo.findIngestionContext(cmd.sensorId);
    if (!ctx) throw new EntityNotFoundException(`SensorNode ${cmd.sensorId} not found.`);
    if (!ctx.thresholdRule) {
      throw new DomainInvariantException(`SensorNode ${cmd.sensorId} has no ThresholdRule configured.`);
    }

    // Filter 1 — physical plausibility & lifecycle guards (→ 422)
    this.engine.assertIngestible(ctx.sensor, ctx.line.isActive, cmd.rawValue, cmd.unit, ctx.thresholdRule);

    // Filters 2 & 3 — sliding window aggregation & threshold classification
    const buffer = await this.engine.ensureBuffer(
      ctx.sensor.getId(),
      ctx.thresholdRule.getWindowSizeSamples(),
    );
    const evaluation = this.engine.evaluate(buffer, ctx.thresholdRule, cmd.rawValue);

    const recordedAt = cmd.recordedAt ? new Date(cmd.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      throw new DomainInvariantException(`Invalid recordedAt: ${cmd.recordedAt}`);
    }

    const reading = TelemetryReading.create({
      id: randomUUID(),
      sensorId: ctx.sensor.getId(),
      rawValue: cmd.rawValue,
      movingAverage: evaluation.movingAverage,
      movingMedian: evaluation.movingMedian,
      unit: cmd.unit,
      windowSampleCount: evaluation.sampleCount,
      recordedAt,
    });

    // Filter 4 — atomic alert + line state transition
    const previousLineStatus = ctx.line.operationalStatus;
    let alert: AnomalyAlert | null = null;
    let newLineStatus: LineStatus = previousLineStatus;

    if (evaluation.breachDetected && evaluation.severity) {
      if (evaluation.severity === AlertSeverity.CRITICAL && previousLineStatus !== LineStatus.FAULT_HALTED) {
        newLineStatus = LineStatus.FAULT_HALTED;
      } else if (evaluation.severity === AlertSeverity.WARNING && previousLineStatus === LineStatus.RUNNING) {
        newLineStatus = LineStatus.DEGRADED_WARNING;
      }

      const sensorSN = ctx.sensor.getSerialNumber().getValue();
      const critical = ctx.thresholdRule.getCriticalLimit().getNumericValue();
      const warning = ctx.thresholdRule.getWarningLimit().getNumericValue();
      const message =
        evaluation.severity === AlertSeverity.CRITICAL
          ? `CRITICAL breach on ${sensorSN}: μ_W=${evaluation.movingAverage.toFixed(3)} ≥ critical ${critical}.`
          : `WARNING breach on ${sensorSN}: μ_W=${evaluation.movingAverage.toFixed(3)} ≥ warning ${warning}.`;

      alert = AnomalyAlert.create({
        id: randomUUID(),
        sensorId: ctx.sensor.getId(),
        lineId: ctx.line.id,
        readingId: reading.id,
        severity: evaluation.severity,
        message,
        triggeredAt: recordedAt,
      });
    }

    await this.repo.ingestTelemetryAtomically({
      reading,
      alert,
      newLineStatusIfBreach: alert ? newLineStatus : null,
    });

    return {
      reading: {
        id: reading.id,
        sensorId: reading.sensorId,
        rawValue: reading.rawValue,
        movingAverage: reading.movingAverage,
        movingMedian: reading.movingMedian,
        unit: reading.unit,
        windowSampleCount: reading.windowSampleCount,
        recordedAt: reading.recordedAt.toISOString(),
      },
      evaluation: {
        breachDetected: evaluation.breachDetected,
        severity: evaluation.severity,
        previousLineStatus,
        newLineStatus: alert ? newLineStatus : previousLineStatus,
        triggeredAlertId: alert?.id ?? null,
      },
    };
  }

  async listReadings(
    query: QueryTelemetryReadingsQuery,
  ): Promise<PaginatedTelemetryReadingsResponseDto> {
    const sensor = await this.repo.findById(query.sensorId);
    if (!sensor) throw new EntityNotFoundException(`SensorNode ${query.sensorId} not found.`);

    const { items, total } = await this.repo.findReadingsBySensorIdPaginated(
      query.sensorId,
      query.page,
      query.pageSize,
    );
    return {
      items: items.map((r) => ({
        id: r.id,
        sensorId: r.sensorId,
        rawValue: r.rawValue,
        movingAverage: r.movingAverage,
        movingMedian: r.movingMedian,
        unit: r.unit,
        windowSampleCount: r.windowSampleCount,
        recordedAt: r.recordedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}