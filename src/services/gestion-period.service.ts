import { Injectable, BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { UserService } from 'src/services/user.service';
import { Gestion } from 'src/interfaces/gestion.interface';

@Injectable()
export class GestionPeriodService {
  constructor(private readonly userService: UserService) {}

  async getAvailableGestions(carnetIdentidad: string): Promise<Gestion[]> {
    const user = await this.userService.findByCarnet(carnetIdentidad);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    const userDate = DateTime.fromISO(user.fecha_ingreso);
    const currentDateTime = DateTime.local();
    const gestions: Gestion[] = [];

    let currentStartDate = userDate;
    while (currentStartDate < currentDateTime) {
      const nextYearDate = currentStartDate.plus({ years: 1 });

      gestions.push({
        startDate: currentStartDate.toJSDate(),
        endDate: nextYearDate.minus({ days: 1 }).toJSDate(),
        label: `GESTION ${currentStartDate.year} - ${nextYearDate.year}`
      });

      currentStartDate = nextYearDate;
    }

    // Excluir el año actual si no se ha cumplido el aniversario de ingreso
    const lastGestion = gestions[gestions.length - 1];
    if (currentDateTime < DateTime.fromJSDate(lastGestion.endDate)) {
      gestions.pop();
    }

    return gestions;
  }
}
