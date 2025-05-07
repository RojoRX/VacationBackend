import { BadRequestException } from "@nestjs/common";

export default function toLocalDateOnly(dateInput: string | Date): Date {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Las fechas deben ser válidas.');
    }
  
    // Convierte a medianoche UTC y luego a local (opcional)
    // Aquí directamente quitamos la hora y dejamos solo la parte de la fecha local
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  