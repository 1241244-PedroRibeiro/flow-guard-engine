export interface StockAdjustmentCommand {
  partId: string;
  units: number;
  reason: string;
  userId: string;
}