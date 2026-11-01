import { DomainError } from './DomainError';

export class ForbiddenDomainException extends DomainError {
  constructor(message = 'Forbidden') {
    super(message);
  }
}