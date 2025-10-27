import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ExternalService {
  private readonly baseUrl = process.env.API_BASE_URL;

  constructor(private readonly http: HttpService) {}

  async getPersonByCI(ci: string) {
    try {
      const url = `${this.baseUrl}?filters[ci][$eq]=${ci}`;

      const { data } = await firstValueFrom(this.http.get(url));

      // Verificamos que haya datos
      if (!data?.data || data.data.length === 0) {
        throw new NotFoundException(`No se encontró una persona con CI ${ci}`);
      }

      const persona = data.data[0].attributes;

      // Mapeamos los datos relevantes
      return {
        ci: persona.ci,
        nombres: persona.nombres,
        apellidoPaterno: persona.apellido_paterno,
        apellidoMaterno: persona.apellido_materno,
        correo: persona.correo_electronico,
        telefono: persona.celular || persona.telefono_fijo,
        direccion: persona.direccion,
        genero: persona.genero,
        fechaNacimiento: persona.fecha_nacimiento,
        profesion: persona.profesion,
        nacionalidad: persona.nacionalidad,
        lugarNacimiento: persona.lugar_nacimiento,
        foto: persona.foto,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      throw new NotFoundException(`Error al consultar la API externa: ${error.message}`);
    }
  }
}
