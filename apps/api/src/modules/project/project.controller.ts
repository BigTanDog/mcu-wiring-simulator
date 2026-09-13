import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createProjectRequestSchema,
  importProjectRequestSchema,
  patchProjectRequestSchema,
  type Project,
  type ProjectDetail,
  type ProjectSnapshot,
} from '@sim/contracts';
import { unprocessable } from '../../common/domain-errors';
import { OwnerKey } from '../../common/owner-key.decorator';
import { ProjectService } from './project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  @Post()
  create(@OwnerKey() ownerKey: string, @Body() body: unknown): Promise<Project> {
    const parsed = createProjectRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw unprocessable('VALIDATION_FAILED', '请求体不符合契约', parsed.error.issues);
    }
    return this.service.create(ownerKey, parsed.data);
  }

  /** 注意：静态路径必须先于 :id 注册，避免被参数路由捕获 */
  @Post('import')
  importProject(@OwnerKey() ownerKey: string, @Body() body: unknown): Promise<Project> {
    const parsed = importProjectRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw unprocessable('VALIDATION_FAILED', '导入内容不符合契约', parsed.error.issues);
    }
    return this.service.importProject(ownerKey, parsed.data);
  }

  @Get(':id')
  detail(@OwnerKey() ownerKey: string, @Param('id') id: string): Promise<ProjectDetail> {
    return this.service.detail(ownerKey, id);
  }

  @Patch(':id')
  patch(
    @OwnerKey() ownerKey: string,
    @Param('id') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ): Promise<{ revision: number; updatedAt: string }> {
    const parsed = patchProjectRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw unprocessable('VALIDATION_FAILED', '请求体不符合契约', parsed.error.issues);
    }
    return this.service.patch(ownerKey, id, ifMatch, parsed.data);
  }

  @Delete(':id')
  remove(@OwnerKey() ownerKey: string, @Param('id') id: string): Promise<{ deleted: true }> {
    return this.service.remove(ownerKey, id);
  }

  @Get(':id/export')
  export(
    @OwnerKey() ownerKey: string,
    @Param('id') id: string,
  ): Promise<ProjectSnapshot & { schemaVersion: number; projectName: string }> {
    return this.service.exportSnapshot(ownerKey, id);
  }
}
