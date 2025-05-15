import { BadRequestException } from "@nestjs/common";

export default function toLocalDateOnly(dateString: string | Date): Date {
  let date: Date;
  if (dateString instanceof Date) {
    date = dateString;
  } else {
    date = new Date(dateString);
  }

  // Obtener los componentes de la fecha en UTC
  const yearUTC = date.getUTCFullYear();
  const monthUTC = date.getUTCMonth();
  const dayUTC = date.getUTCDate();

  // Crear una nueva Date que represente esa fecha en UTC a las 00:00:00 UTC
  return new Date(Date.UTC(yearUTC, monthUTC, dayUTC, 0, 0, 0, 0));
}