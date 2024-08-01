import { Injectable } from '@nestjs/common';
import { User } from 'src/interfaces/user.interface';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class UserService {
  constructor(private readonly httpService: HttpService) {}

  findAll(): Observable<User[]> {
    const apiUrl = process.env.API_BASE_URL || 'https://api.externa.com/users';
    return this.httpService.get<User[]>(apiUrl).pipe(
      map(response => response.data)
    );
  }

  findOne(id: number): Observable<User> {
    const apiUrl = process.env.API_BASE_URL || 'https://api.externa.com/users';
    return this.httpService.get<User>(`${apiUrl}/${id}`).pipe(
      map(response => response.data)
    );
  }

  findByCarnet(carnetIdentidad: string): Observable<User> {
    const apiUrl = process.env.API_BASE_URL || 'https://api.externa.com/users';
    return this.httpService.get<User[]>(`${apiUrl}?carnetIdentidad=${carnetIdentidad}`).pipe(
      map(response => {
        const user = response.data.find(user => user.carnetIdentidad === carnetIdentidad);
        return user || null;
      })
    );
  }
}
