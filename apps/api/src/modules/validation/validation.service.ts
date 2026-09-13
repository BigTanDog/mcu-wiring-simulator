import { Injectable } from '@nestjs/common';
import type { RuleSetInfo, ValidateRequest, ValidationResult } from '@sim/contracts';
import { COMPONENTS, findBoard } from '@sim/definitions';
import { getRuleSetInfo, validateProject } from '@sim/rule-engine';
import { notFound } from '../../common/domain-errors';

/**
 * 校验编排（§8.2）：只做定义装配与引擎调用，不内联任何规则逻辑。
 * 规则实现来自 @sim/rule-engine（与前端同一份代码，保证结论一致）。
 */
@Injectable()
export class ValidationService {
  validate(request: ValidateRequest): ValidationResult {
    const { snapshot } = request;

    const board = findBoard(snapshot.boardSlug);
    if (!board) {
      throw notFound('DEFINITION_NOT_FOUND', `未找到开发板定义 ${snapshot.boardSlug}`);
    }

    const usedSlugs = [...new Set(snapshot.instances.map((item) => item.definitionSlug))];
    const missingSlugs = usedSlugs.filter((slug) => !COMPONENTS.some((def) => def.slug === slug));
    if (missingSlugs.length > 0) {
      throw notFound('DEFINITION_NOT_FOUND', `未找到组件定义: ${missingSlugs.join(', ')}`);
    }

    const defs = COMPONENTS.filter((def) => usedSlugs.includes(def.slug));

    const result = validateProject({
      board,
      instances: snapshot.instances,
      connections: snapshot.connections,
      defs,
      options: {
        wifiEnabled: snapshot.options.wifiEnabled,
        mode: snapshot.options.mode,
        ruleConfigs: request.ruleConfigs,
      },
    });

    return { ...result, source: 'server' };
  }

  ruleSet(): RuleSetInfo {
    return getRuleSetInfo();
  }
}
