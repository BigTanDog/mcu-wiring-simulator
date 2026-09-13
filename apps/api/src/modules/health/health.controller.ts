import { Controller, Get } from '@nestjs/common';
import { BOARDS, COMPONENTS } from '@sim/definitions';
import { RULES, RULE_SET_VERSION } from '@sim/rule-engine';
import { PrismaService } from '../../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health(): Promise<{ status: string; version: string; db: string }> {
    const db = (await this.prisma.ping()) ? 'ok' : 'error';
    return { status: db === 'ok' ? 'ok' : 'degraded', version: '0.1.0', db };
  }

  /** 版本信息：前端据此提示"规则集已更新"（§9.2） */
  @Get('version')
  version(): {
    apiVersion: string;
    ruleSetVersion: string;
    boardCount: number;
    componentCount: number;
    ruleCount: number;
  } {
    return {
      apiVersion: 'v1',
      ruleSetVersion: RULE_SET_VERSION,
      boardCount: BOARDS.length,
      componentCount: COMPONENTS.length,
      ruleCount: RULES.length,
    };
  }
}
