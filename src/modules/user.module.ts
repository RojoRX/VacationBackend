import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserController } from 'src/controllers/user.controller';
import { UserService } from 'src/services/user.service';
import { MockUserService } from 'src/mocks/user.service.mock';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [UserController],
  providers: [
    {
      provide: UserService,
      useFactory: (configService: ConfigService, httpService: HttpService) => {
        const useMock = configService.get<string>('USE_MOCK') === 'true';
        return useMock ? new MockUserService() : new UserService(httpService);
      },
      inject: [ConfigService, HttpService],
    },
  ],
  exports: [UserService],
})
export class UserModule {}
