import { DomainError } from './DomainError';

export class UnauthorizedDomainException extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}