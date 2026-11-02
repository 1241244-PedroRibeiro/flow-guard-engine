import { TelemetryReadingResponseDto } from './TelemetryReadingResponseDto';

export interface PaginatedTelemetryReadingsResponseDto {
  items: TelemetryReadingResponseDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}