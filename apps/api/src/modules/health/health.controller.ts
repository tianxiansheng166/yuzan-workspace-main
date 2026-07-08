import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get('live')
  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  @Get('ready')
  ready(): { status: 'ok'; timestamp: string } {
    // GOV-001/GOV-003 will add database readiness.
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
