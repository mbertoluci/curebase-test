import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { API_ROUTES, API_TAGS } from '../common/api.constants';

/** Liveness endpoint - lets a load balancer or the web app probe the API. */
@ApiTags(API_TAGS.health)
@Controller(API_ROUTES.health)
export class AppController {
  @Get()
  health(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
