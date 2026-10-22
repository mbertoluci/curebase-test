import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/** Liveness endpoint - lets a load balancer or the web app probe the API. */
@ApiTags('health')
@Controller('health')
export class AppController {
  @Get()
  health(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
