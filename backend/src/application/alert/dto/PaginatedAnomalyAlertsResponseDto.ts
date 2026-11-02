import { AnomalyAlertResponseDto } from './AnomalyAlertResponseDto';

export interface PaginatedAnomalyAlertsResponseDto {
  items: AnomalyAlertResponseDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}