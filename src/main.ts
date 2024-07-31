import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  console.log(`USE_MOCK: ${configService.get<string>('USE_MOCK')}`); // Verifica el valor aquí
  await app.listen(3000);
}
bootstrap();
