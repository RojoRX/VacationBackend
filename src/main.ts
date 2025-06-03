import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar CORS para permitir acceso desde localhost:3001
  app.enableCors({
    origin: process.env.FRONTEND_HOST, // Permitir solicitudes desde localhost:3001
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Métodos permitidos
    credentials: true, // Habilitar credenciales si es necesario
  });

  const configService = app.get(ConfigService);
  console.log(`USE_MOCK: ${configService.get<string>('USE_MOCK')}`); // Verifica el valor aquí

  const config = new DocumentBuilder()
    .setTitle('Vacaciones Backend API')
    .setDescription('The API Vacations description')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token', // <-- Este es el nombre de la seguridad, úsalo luego en decorators
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);


  // Añadir requerimiento de seguridad global
  document.components = {
    ...document.components,
    securitySchemes: {
      'access-token': {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  };

  document.security = [
    {
      'access-token': [],
    },
  ];
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.BACKEND_PORT || 4001);
}

bootstrap();
