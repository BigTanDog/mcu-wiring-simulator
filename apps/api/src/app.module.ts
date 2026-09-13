import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BoardModule } from './modules/board/board.module';
import { ComponentModule } from './modules/component/component.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectModule } from './modules/project/project.module';
import { ValidationModule } from './modules/validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    BoardModule,
    ComponentModule,
    ValidationModule,
    ProjectModule,
  ],
})
export class AppModule {}
