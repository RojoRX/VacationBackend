// src/scripts/bootstrapAdmin.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';           // ✅ Ruta relativa CORRECTA
import { User } from '../entities/user.entity';      // ✅ Ruta relativa CORRECTA  
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RoleEnum } from '../enums/role.enum';       // ✅ Ruta relativa CORRECTA

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepo: Repository<User> = app.get('UserRepository');
  const existingAdmin = await userRepo.findOne({ where: { username: 'admin' } });
  if (existingAdmin) {
    console.log('Admin ya existe');
    await app.close();
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  const admin = userRepo.create({
    username: 'admin',
    password: hashedPassword,
    email: 'admin@example.com',
    role: RoleEnum.ADMIN,
    ci: '00000000',
    fecha_ingreso: new Date().toISOString().split('T')[0],
  });

  await userRepo.save(admin);
  console.log('Usuario admin creado: admin / Admin123!');

  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});