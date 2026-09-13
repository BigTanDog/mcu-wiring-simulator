import { Controller, Get, Param, Query } from '@nestjs/common';
import type { ComponentDef } from '@sim/contracts';
import { ComponentService, type ComponentSummary } from './component.service';

@Controller('components')
export class ComponentController {
  constructor(private readonly service: ComponentService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('q') q?: string,
  ): Promise<ComponentSummary[]> {
    return this.service.list(category, q);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string, @Query('version') version?: string): Promise<ComponentDef> {
    return this.service.detail(slug, version);
  }
}
