import { Controller, Get } from '@nestjs/common';
import { AppService, HealthResult } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): Promise<HealthResult> {
    return this.appService.getHealth();
  }
}
