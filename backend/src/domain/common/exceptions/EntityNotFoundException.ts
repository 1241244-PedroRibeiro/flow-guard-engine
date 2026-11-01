import { DomainError } from './DomainError';

export class EntityNotFoundException extends DomainError {
  constructor(message = 'Entity not found') {
    super(message);
  }
}