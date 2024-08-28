import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from 'src/controllers/user.controller';
import { UserService } from 'src/services/user.service';
import { User } from 'src/entities/user.entity'; // Ajusta la ruta según tu estructura
import { MockUserService } from 'src/mocks/user.service.mock';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([User]), // Importa el módulo TypeOrm para la entidad User
  ],
  controllers: [UserController],
  providers: [
    {
      provide: UserService,
      useClass: UserService, // Usamos `useClass` para asegurar la inyección adecuada
    },
    {
      provide: 'USE_MOCK',
      useFactory: async (configService: ConfigService) => configService.get<string>('USE_MOCK'),
      inject: [ConfigService],
    },
    {
      provide: MockUserService,
      useClass: MockUserService,
    },
  ],
  exports: [UserService],
})
export class UserModule {}
