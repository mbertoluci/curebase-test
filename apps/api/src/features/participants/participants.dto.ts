import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BmiBand, Unit } from '@org/contracts';
import type {
  CreateParticipantInput,
  ListParticipantsQuery,
  ParticipantSortField,
  ParticipantView,
  SortDirection,
} from '@org/contracts';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SORT_FIELDS: ParticipantSortField[] = [
  'createdAt',
  'bmiValue',
  'age',
  'lastName',
];
const SORT_DIRS: SortDirection[] = ['asc', 'desc'];

/**
 * POST body. class-validator here does the *structural* validation (types,
 * format, presence, generic ranges). Per-unit plausibility is a domain rule and
 * lives in the service. `@Type(() => Number)` lets the ValidationPipe coerce the
 * JSON/query value before the numeric checks run.
 */
export class CreateParticipantDto implements CreateParticipantInput {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ format: 'email', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiProperty({ description: 'lb when unit=US, kg when unit=METRIC' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weight!: number;

  @ApiProperty({ description: 'inches when unit=US, cm when unit=METRIC' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  height!: number;

  @ApiProperty({ enum: Unit })
  @IsEnum(Unit)
  unit!: Unit;

  @ApiProperty({ minimum: 0, maximum: 120 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age!: number;
}

/** PUT body - every field optional, same validators applied when present. */
export class UpdateParticipantDto extends PartialType(CreateParticipantDto) {}

/** Allow-listed query contract for GET /participants. */
export class ListParticipantsQueryDto implements ListParticipantsQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Matches first name, last name or email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ enum: Unit })
  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minBmi?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxBmi?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minAge?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxAge?: number;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: ParticipantSortField;

  @ApiPropertyOptional({ enum: SORT_DIRS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_DIRS)
  sortDir?: SortDirection;
}

/** Response shape (controller "delivers a DTO"). Mirrors ParticipantView. */
export class ParticipantDto implements ParticipantView {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty() weight!: number;
  @ApiProperty() height!: number;
  @ApiProperty({ enum: Unit }) unit!: Unit;
  @ApiProperty() age!: number;
  @ApiProperty() bmiValue!: number;
  @ApiProperty({ enum: BmiBand, nullable: true }) bmiBand!: BmiBand | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
