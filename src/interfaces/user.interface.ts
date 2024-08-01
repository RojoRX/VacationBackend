export interface User {
  id: number;
  name: string;
  email: string;
  position: string;
  department: string;
  fechaIngreso: string;
  permisos: number;
  carnetIdentidad: string; // Nuevo campo
}
