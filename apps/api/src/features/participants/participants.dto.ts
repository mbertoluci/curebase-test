import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  AGE_BOUNDS,
  BmiBand,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  MAX_PAGE_SIZE,
  normalizeEmail,
  PARTICIPANT_SORT_FIELDS,
  SORT_DIRECTIONS,
  Unit,
} from '@org/contracts';
import type {
  CreateParticipantInput,
  ListParticipantsQuery,
  PageInfo,
  Paginated,
  ParticipantSortField,
  ParticipantView,
  SortDirection,
} from '@org/contracts';
import { Transform, Type } from 'class-transformer';
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

// The runtime allow-lists come from the shared contract (single source of
// truth with ParticipantSortField / SortDirection); spread into mutable arrays
// for the decorators that expect them.
const SORT_FIELDS = [...PARTICIPANT_SORT_FIELDS];
const SORT_DIRS = [...SORT_DIRECTIONS];

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
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // @IsOptional() skips validation for both undefined and null, so phone keeps
  // accepting null even under the update DTO's skipNullProperties: false.
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

  @ApiProperty({ minimum: AGE_BOUNDS.min, maximum: AGE_BOUNDS.max })
  @Type(() => Number)
  @IsInt()
  @Min(AGE_BOUNDS.min)
  @Max(AGE_BOUNDS.max)
  age!: number;
}

/**
 * PUT body - every field optional, same validators applied when present.
 * skipNullProperties: false so an explicit null on a required field (e.g.
 * firstName) is validated and rejected (400) instead of reaching Prisma and
 * blowing up a NOT NULL column (500). phone stays nullable via its @IsOptional.
 */
export class UpdateParticipantDto extends PartialType(CreateParticipantDto, {
  skipNullProperties: false,
}) {}

/** Allow-listed query contract for GET /participants. */
export class ListParticipantsQueryDto implements ListParticipantsQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
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

  @ApiPropertyOptional({ minimum: AGE_BOUNDS.min, maximum: AGE_BOUNDS.max })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AGE_BOUNDS.min)
  @Max(AGE_BOUNDS.max)
  minAge?: number;

  @ApiPropertyOptional({ minimum: AGE_BOUNDS.min, maximum: AGE_BOUNDS.max })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AGE_BOUNDS.min)
  @Max(AGE_BOUNDS.max)
  maxAge?: number;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: DEFAULT_SORT_FIELD })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: ParticipantSortField;

  @ApiPropertyOptional({ enum: SORT_DIRS, default: DEFAULT_SORT_DIR })
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

/** Page metadata for the list envelope. */
export class PageInfoDto implements PageInfo {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

/**
 * GET /participants response. The list returns this envelope, not a bare array,
 * so OpenAPI must document { data, pageInfo } (not isArray) or generated clients
 * break.
 */
export class PaginatedParticipantsDto implements Paginated<ParticipantView> {
  @ApiProperty({ type: ParticipantDto, isArray: true })
  data!: ParticipantDto[];

  @ApiProperty({ type: PageInfoDto })
  pageInfo!: PageInfoDto;
}
