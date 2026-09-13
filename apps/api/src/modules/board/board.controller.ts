import { Controller, Get, Param, Query } from '@nestjs/common';
import { BoardService, type BoardSummary } from './board.service';
import type { BoardDef } from '@sim/contracts';

@Controller('boards')
export class BoardController {
  constructor(private readonly service: BoardService) {}

  @Get()
  list(): Promise<BoardSummary[]> {
    return this.service.list();
  }

  @Get(':slug')
  detail(@Param('slug') slug: string, @Query('version') version?: string): Promise<BoardDef> {
    return this.service.detail(slug, version);
  }
}
