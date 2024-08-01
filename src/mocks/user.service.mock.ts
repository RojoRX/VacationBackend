import { Injectable } from '@nestjs/common';
import { User } from 'src/interfaces/user.interface';
import { Observable, of } from 'rxjs';

@Injectable()
export class MockUserService {
  private mockUsers: User[] = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      position: 'Professor',
      department: 'Computer Science',
      fechaIngreso: '2020-01-15',
      permisos: 5,
      carnetIdentidad: '12345678', // Nuevo campo
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      position: 'Administrator',
      department: 'Human Resources',
      fechaIngreso: '2019-06-10',
      permisos: 12,
      carnetIdentidad: '23456789', // Nuevo campo
    },
    {
      id: 3,
      name: 'Alice Johnson',
      email: 'alice.johnson@example.com',
      position: 'Lecturer',
      department: 'Mathematics',
      fechaIngreso: '2021-09-23',
      permisos: 8,
      carnetIdentidad: '34567890', // Nuevo campo
    },
    {
      id: 4,
      name: 'Bob Brown',
      email: 'bob.brown@example.com',
      position: 'IT Support',
      department: 'Information Technology',
      fechaIngreso: '2018-11-05',
      permisos: 20,
      carnetIdentidad: '45678901', // Nuevo campo
    },
    {
      id: 5,
      name: 'Emily Davis',
      email: 'emily.davis@example.com',
      position: 'Researcher',
      department: 'Physics',
      fechaIngreso: '2024-03-12',
      permisos: 3,
      carnetIdentidad: '56789012', // Nuevo campo
    },
    {
      id: 6,
      name: 'Charlie Garcia',
      email: 'charlie.garcia@example.com',
      position: 'Marketing Manager',
      department: 'Marketing',
      fechaIngreso: '2020-07-21',
      permisos: 15,
      carnetIdentidad: '67890123', // Nuevo campo
    },
    {
      id: 7,
      name: 'Alice Miller',
      email: 'alice.miller@example.com',
      position: 'Accountant',
      department: 'Finance',
      fechaIngreso: '2019-02-09',
      permisos: 10,
      carnetIdentidad: '78901234', // Nuevo campo
    },
    {
      id: 8,
      name: 'David Johnson',
      email: 'david.johnson@example.com',
      position: 'Software Engineer',
      department: 'Engineering',
      fechaIngreso: '2023-08-28',
      permisos: 25,
      carnetIdentidad: '89012345', // Nuevo campo
    },
    {
      id: 9,
      name: 'Sophia Lee',
      email: 'sophia.lee@example.com',
      position: 'Human Resources Manager',
      department: 'Human Resources',
      fechaIngreso: '2022-05-17',
      permisos: 12,
      carnetIdentidad: '90123456', // Nuevo campo
    },
    {
      id: 10,
      name: 'Michael Williams',
      email: 'michael.williams@example.com',
      position: 'Sales Representative',
      department: 'Sales',
      fechaIngreso: '2024-05-03',
      permisos: 8,
      carnetIdentidad: '01234567', // Nuevo campo
    }
    
  ];

  findAll(): Observable<User[]> {
    return of(this.mockUsers);
  }

  findOne(id: number): Observable<User> {
    const user = this.mockUsers.find(user => user.id === id);
    return of(user || null);
  }

  findByCarnet(carnetIdentidad: string): Observable<User> {
    const user = this.mockUsers.find(user => user.carnetIdentidad === carnetIdentidad);
    return of(user || null);
  }
}
