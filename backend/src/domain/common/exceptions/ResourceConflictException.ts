import { DomainError } from './DomainError';

export class ResourceConflictException extends DomainError {
  constructor(message = 'Resource conflict') {
    super(message);
  }
}