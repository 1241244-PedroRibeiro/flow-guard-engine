export interface UpsertThresholdRuleCommand {
    warningLimit: number;
    criticalLimit: number;
    unit: string;
    windowSizeSamples?: number;
}