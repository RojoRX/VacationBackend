// user.interface.ts
export interface User {
  id: number; // 'id' está en el nivel superior
  attributes: {
    ci: string;
    extension: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    genero: string;
    fecha_nacimiento: string;
    mayor_edad: boolean;
    estado_civil: string;
    direccion: string;
    telefono_fijo: string;
    celular: string;
    telefono_coorpo: string;
    correo_electronico: string;
    profesion: string;
    libreta_militar: string;
    nacionalidad: string;
    lugar_nacimiento: string;
    clase_de_documento: string;
    fecha_ingreso: string;
    id_tipo_contrato: number;
    baja: number;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
  };
}
