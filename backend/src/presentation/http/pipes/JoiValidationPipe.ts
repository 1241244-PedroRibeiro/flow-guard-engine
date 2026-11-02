import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import Joi from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private readonly schema: Joi.ObjectSchema) {}

  transform(value: unknown) {
    const { error, value: validated } = this.schema.validate(value, {
      stripUnknown: true,   // KB §20 — mass-assignment defense
      abortEarly: false,
      convert: true,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return validated;
  }
}