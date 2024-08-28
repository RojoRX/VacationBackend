import { Injectable } from '@nestjs/common';
import { User } from 'src/interfaces/user.interface';
import { Observable, of } from 'rxjs';

@Injectable()
export class MockUserService {
  private mockUsers: User[] = [
    {
      id: 1,
      attributes: {
        ci: '12345678',
        extension: 'LP',
        nombres: 'John',
        apellido_paterno: 'Doe',
        apellido_materno: 'Smith',
        genero: 'Masculino',
        fecha_nacimiento: '1980-02-15',
        mayor_edad: true,
        estado_civil: 'Soltero',
        direccion: '123 Main St',
        telefono_fijo: '1234567',
        celular: '78901234',
        telefono_coorpo: '1234567890',
        correo_electronico: 'john.doe@example.com',
        profesion: 'Professor',
        libreta_militar: '1234567890',
        nacionalidad: 'Boliviano',
        lugar_nacimiento: 'La Paz',
        clase_de_documento: 'CI',
        fecha_ingreso: '2020-01-15',
        id_tipo_contrato: 1,
        baja: 0,
        createdAt: '2020-01-01',
        updatedAt: '2020-01-01',
        publishedAt: '2020-01-01',
      },
    },
    {
      id: 2,
      attributes: {
        ci: '23456789',
        extension: 'SC',
        nombres: 'Jane',
        apellido_paterno: 'Smith',
        apellido_materno: 'Johnson',
        genero: 'Femenino',
        fecha_nacimiento: '1985-06-25',
        mayor_edad: true,
        estado_civil: 'Casada',
        direccion: '456 Maple St',
        telefono_fijo: '2345678',
        celular: '89012345',
        telefono_coorpo: '2345678901',
        correo_electronico: 'jane.smith@example.com',
        profesion: 'Administrator',
        libreta_militar: '',
        nacionalidad: 'Boliviana',
        lugar_nacimiento: 'Santa Cruz',
        clase_de_documento: 'CI',
        fecha_ingreso: '2019-06-10',
        id_tipo_contrato: 2,
        baja: 0,
        createdAt: '2019-06-01',
        updatedAt: '2019-06-01',
        publishedAt: '2019-06-01',
      },
    },
    {
      id: 3,
      attributes: {
        ci: '34567890',
        extension: 'CB',
        nombres: 'Alice',
        apellido_paterno: 'Johnson',
        apellido_materno: 'Brown',
        genero: 'Femenino',
        fecha_nacimiento: '1990-09-10',
        mayor_edad: true,
        estado_civil: 'Soltera',
        direccion: '789 Oak St',
        telefono_fijo: '3456789',
        celular: '90123456',
        telefono_coorpo: '3456789012',
        correo_electronico: 'alice.johnson@example.com',
        profesion: 'Lecturer',
        libreta_militar: '',
        nacionalidad: 'Boliviana',
        lugar_nacimiento: 'Cochabamba',
        clase_de_documento: 'CI',
        fecha_ingreso: '2021-09-23',
        id_tipo_contrato: 3,
        baja: 0,
        createdAt: '2021-09-01',
        updatedAt: '2021-09-01',
        publishedAt: '2021-09-01',
      },
    },
    {
      id: 4,
      attributes: {
        ci: '45678901',
        extension: 'PT',
        nombres: 'Bob',
        apellido_paterno: 'Brown',
        apellido_materno: 'Davis',
        genero: 'Masculino',
        fecha_nacimiento: '1988-11-15',
        mayor_edad: true,
        estado_civil: 'Casado',
        direccion: '321 Pine St',
        telefono_fijo: '4567890',
        celular: '01234567',
        telefono_coorpo: '4567890123',
        correo_electronico: 'bob.brown@example.com',
        profesion: 'IT Support',
        libreta_militar: '2345678901',
        nacionalidad: 'Boliviano',
        lugar_nacimiento: 'Potosí',
        clase_de_documento: 'CI',
        fecha_ingreso: '2018-11-05',
        id_tipo_contrato: 1,
        baja: 0,
        createdAt: '2018-11-01',
        updatedAt: '2018-11-01',
        publishedAt: '2018-11-01',
      },
    },
    {
      id: 5,
      attributes: {
        ci: '56789012',
        extension: 'OR',
        nombres: 'Emily',
        apellido_paterno: 'Davis',
        apellido_materno: 'Garcia',
        genero: 'Femenino',
        fecha_nacimiento: '1995-03-20',
        mayor_edad: true,
        estado_civil: 'Soltera',
        direccion: '654 Cedar St',
        telefono_fijo: '5678901',
        celular: '12345678',
        telefono_coorpo: '5678901234',
        correo_electronico: 'emily.davis@example.com',
        profesion: 'Researcher',
        libreta_militar: '',
        nacionalidad: 'Boliviana',
        lugar_nacimiento: 'Oruro',
        clase_de_documento: 'CI',
        fecha_ingreso: '2024-03-12',
        id_tipo_contrato: 2,
        baja: 0,
        createdAt: '2024-03-01',
        updatedAt: '2024-03-01',
        publishedAt: '2024-03-01',
      },
    },
    {
      id: 6,
      attributes: {
        ci: '67890123',
        extension: 'SC',
        nombres: 'Charlie',
        apellido_paterno: 'Garcia',
        apellido_materno: 'Lopez',
        genero: 'Masculino',
        fecha_nacimiento: '1975-07-10',
        mayor_edad: true,
        estado_civil: 'Casado',
        direccion: '987 Birch St',
        telefono_fijo: '6789012',
        celular: '23456789',
        telefono_coorpo: '6789012345',
        correo_electronico: 'charlie.garcia@example.com',
        profesion: 'Marketing Manager',
        libreta_militar: '3456789012',
        nacionalidad: 'Boliviano',
        lugar_nacimiento: 'Santa Cruz',
        clase_de_documento: 'CI',
        fecha_ingreso: '2000-07-21',
        id_tipo_contrato: 1,
        baja: 0,
        createdAt: '2000-07-01',
        updatedAt: '2000-07-01',
        publishedAt: '2000-07-01',
      },
    },
    {
      id: 7,
      attributes: {
        ci: '78901234',
        extension: 'LP',
        nombres: 'Alice',
        apellido_paterno: 'Miller',
        apellido_materno: 'Thompson',
        genero: 'Femenino',
        fecha_nacimiento: '1987-02-09',
        mayor_edad: true,
        estado_civil: 'Soltera',
        direccion: '111 Willow St',
        telefono_fijo: '7890123',
        celular: '34567890',
        telefono_coorpo: '7890123456',
        correo_electronico: 'alice.miller@example.com',
        profesion: 'Accountant',
        libreta_militar: '',
        nacionalidad: 'Boliviana',
        lugar_nacimiento: 'La Paz',
        clase_de_documento: 'CI',
        fecha_ingreso: '2019-02-09',
        id_tipo_contrato: 2,
        baja: 0,
        createdAt: '2019-02-01',
        updatedAt: '2019-02-01',
        publishedAt: '2019-02-01',
      },
    },
    {
      id: 8,
      attributes: {
        ci: '89012345',
        extension: 'CB',
        nombres: 'David',
        apellido_paterno: 'Johnson',
        apellido_materno: 'Martinez',
        genero: 'Masculino',
        fecha_nacimiento: '1992-08-28',
        mayor_edad: true,
        estado_civil: 'Casado',
        direccion: '222 Elm St',
        telefono_fijo: '8901234',
        celular: '45678901',
        telefono_coorpo: '8901234567',
        correo_electronico: 'david.johnson@example.com',
        profesion: 'Software Engineer',
        libreta_militar: '4567890123',
        nacionalidad: 'Boliviano',
        lugar_nacimiento: 'Cochabamba',
        clase_de_documento: 'CI',
        fecha_ingreso: '2023-08-28',
        id_tipo_contrato: 3,
        baja: 0,
        createdAt: '2023-08-01',
        updatedAt: '2023-08-01',
        publishedAt: '2023-08-01',
      },
    },
    {
      id: 9,
      attributes: {
        ci: '90123456',
        extension: 'SC',
        nombres: 'Sophia',
        apellido_paterno: 'Lee',
        apellido_materno: 'Kim',
        genero: 'Femenino',
        fecha_nacimiento: '1989-05-17',
        mayor_edad: true,
        estado_civil: 'Casada',
        direccion: '333 Cedar St',
        telefono_fijo: '9012345',
        celular: '56789012',
        telefono_coorpo: '9012345678',
        correo_electronico: 'sophia.lee@example.com',
        profesion: 'Human Resources Manager',
        libreta_militar: '',
        nacionalidad: 'Boliviana',
        lugar_nacimiento: 'Santa Cruz',
        clase_de_documento: 'CI',
        fecha_ingreso: '2022-05-17',
        id_tipo_contrato: 2,
        baja: 0,
        createdAt: '2022-05-01',
        updatedAt: '2022-05-01',
        publishedAt: '2022-05-01',
      },
    },
    {
      id: 10,
      attributes: {
        ci: '01234567',
        extension: 'PT',
        nombres: 'Michael',
        apellido_paterno: 'Williams',
        apellido_materno: 'Clark',
        genero: 'Masculino',
        fecha_nacimiento: '1990-05-03',
        mayor_edad: true,
        estado_civil: 'Soltero',
        direccion: '444 Aspen St',
        telefono_fijo: '0123456',
        celular: '67890123',
        telefono_coorpo: '0123456789',
        correo_electronico: 'michael.williams@example.com',
        profesion: 'Sales Representative',
        libreta_militar: '',
        nacionalidad: 'Boliviano',
        lugar_nacimiento: 'Potosí',
        clase_de_documento: 'CI',
        fecha_ingreso: '2024-05-03',
        id_tipo_contrato: 1,
        baja: 0,
        createdAt: '2024-05-01',
        updatedAt: '2024-05-01',
        publishedAt: '2024-05-01',
      },
    },
  ];

  findAll(): Observable<User[]> {
    return of(this.mockUsers);
  }

  findOne(id: number): Observable<User> {
    const user = this.mockUsers.find(user => user.id === id);
    return of(user || null);
  }

  findByCarnet(carnetIdentidad: string): Observable<User> {
    const user = this.mockUsers.find(user => user.attributes.ci === carnetIdentidad);
    return of(user || null);
  }
}
