import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service';

/**
 * Generic "does this id exist?" validator.
 *
 * Runs a single existence query against any Prisma model, scoped to non-deleted
 * rows so a soft-deleted tombstone never counts as present.
 *
 * IMPORTANT (why it is not wired to the :id route param): this is a validation-
 * time convenience, not a guarantee. There is a TOCTOU gap between validating
 * and writing, so the authoritative existence/uniqueness check lives in the
 * service inside the transaction (returning a proper 404/409). Use this decorator
 * for body fields that reference another entity as the schema grows.
 */
@ValidatorConstraint({ name: 'Exists', async: true })
@Injectable()
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    if (value === undefined || value === null || value === '') return true; // presence is a separate concern
    const [model] = args.constraints as [string];
    const delegate = (
      this.prisma as unknown as Record<
        string,
        { findFirst(args: unknown): Promise<unknown> }
      >
    )[model];
    if (!delegate) return false;
    const row = await delegate.findFirst({
      where: { id: value, deletedAt: null },
    });
    return row !== null;
  }

  defaultMessage(args: ValidationArguments): string {
    const [model] = args.constraints as [string];
    return `${model} "${args.value}" does not exist`;
  }
}

/** Field decorator: `@Exists('participant')`. */
export function Exists(model: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'Exists',
      target: object.constructor,
      propertyName,
      constraints: [model],
      options: validationOptions,
      validator: ExistsConstraint,
    });
  };
}
