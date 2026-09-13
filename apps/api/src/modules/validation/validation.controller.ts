import { Body, Controller, Get, Post } from '@nestjs/common';
import { validateRequestSchema, type RuleSetInfo, type ValidationResult } from '@sim/contracts';
import { unprocessable } from '../../common/domain-errors';
import { ValidationService } from './validation.service';

@Controller()
export class ValidationController {
  constructor(private readonly service: ValidationService) {}

  /** POST /api/v1/validate —— 无状态校验（幂等：同快照 → 同结论） */
  @Post('validate')
  validate(@Body() body: unknown): ValidationResult {
    const parsed = validateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw unprocessable('VALIDATION_FAILED', '请求体不符合契约', parsed.error.issues);
    }
    return this.service.validate(parsed.data);
  }

  /** GET /api/v1/rule-sets/latest —— 当前规则集元数据 */
  @Get('rule-sets/latest')
  ruleSet(): RuleSetInfo {
    return this.service.ruleSet();
  }
}
