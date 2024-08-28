import { Injectable } from '@nestjs/common';
import { User } from 'src/interfaces/user.interface';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class UserService {
  private readonly apiUrl: string;

  constructor(private readonly httpService: HttpService) {
    this.apiUrl = process.env.API_BASE_URL || 'http://localhost:1337/api/personas';
  }

  findAll(): Observable<User[]> {
    return this.httpService.get<{ data: User[] }>(this.apiUrl).pipe(
      map(response => response.data.data) // Extrae el array 'data' del objeto de respuesta
    );
  }

  findOne(id: number): Observable<User> {
    return this.httpService.get<{ data: User }>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data.data) // Extrae el objeto 'data' del objeto de respuesta
    );
  }

  findByCarnet(carnetIdentidad: string): Observable<User> {
    return this.httpService.get<{ data: User[] }>(`${this.apiUrl}?filters[ci][$eq]=${carnetIdentidad}`).pipe(
      map(response => {
        const user = response.data.data[0]; // Toma el primer usuario que coincida
        return user || null;
      })
    );
  }
}
