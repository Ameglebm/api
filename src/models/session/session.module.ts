import { Module } from '@nestjs/common';
import { SessionController } from './controller/session.controller';
import { SessionService } from './service/session.service';
import { SessionRepository } from './repository/session.repository';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { SESSION_REPOSITORY, SESSION_SERVICE } from './session.constants';

@Module({
  imports: [PrismaModule],
  controllers: [SessionController],
  providers: [
    {
      provide: SESSION_SERVICE,
      useClass: SessionService,
    },
    {
      provide: SESSION_REPOSITORY,
      useClass: SessionRepository,
    },
  ],
  exports: [SESSION_SERVICE],
})
export class SessionModule {}
