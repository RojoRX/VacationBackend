import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { HolidayPeriodService } from './holydayperiod.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { DateTime } from 'luxon';
import { firstValueFrom } from 'rxjs';
import { NonHoliday } from 'src/entities/nonholiday.entity';

@Injectable()
export class VacationService {
  constructor(
    private readonly userService: UserService,
    private readonly holidayPeriodService: HolidayPeriodService,
    private readonly nonHolidayService: NonHolidayService,
  ) {}

  async getCurrentYearVacationData(carnetIdentidad: string, year: number): Promise<any> {
    const user = await firstValueFrom(this.userService.findByCarnet(carnetIdentidad));
    
    if (!user) {
      throw new BadRequestException(`Usuario con carnet de identidad ${carnetIdentidad} no encontrado`);
    }
  
    const today = DateTime.now();
    const startDate = DateTime.fromISO(user.fechaIngreso);
    const yearsOfService = today.year - startDate.year - (today.month < startDate.month ? 1 : 0);
    const monthsOfService = today.month - startDate.month + (today.month < startDate.month ? 12 : 0);
    const userVacationDays = this.calculateVacationDays(yearsOfService);
  
    const holidays = await this.holidayPeriodService.getHolidayPeriods(year);
    const nonHolidays = await this.nonHolidayService.getNonHolidayDays(year);
  
    let totalHolidayDays = 0;
    const holidayDetails = holidays.map(holiday => {
      const startDate = DateTime.fromJSDate(holiday.startDate);
      const endDate = DateTime.fromJSDate(holiday.endDate);
  
      let weekdays = 0;
      if (endDate <= today) {
        weekdays = this.calculateWeekdaysBetween(startDate, endDate);
      } else if (startDate <= today) {
        weekdays = this.calculateWeekdaysBetween(startDate, today);
      }
  
      // Ajusta los días hábiles para descontar los días no hábiles
      weekdays = this.adjustWeekdaysForNonHolidays(startDate, today, nonHolidays);
  
      totalHolidayDays += weekdays;
      return { ...holiday, weekdays };
    });
  
    const totalNonHolidayDays = await this.calculateTotalNonHolidayDays(nonHolidays, today.toJSDate());
  
    const availableVacationDays = userVacationDays - totalHolidayDays + totalNonHolidayDays;
  
    return {
      carnetIdentidad: user.carnetIdentidad,
      name: user.name,
      email: user.email,
      position: user.position,
      department: user.department,
      yearsOfService,
      monthsOfService,
      userVacationDays,
      totalHolidayDays,
      totalNonHolidayDays,
      availableVacationDays,
      holidayDetails
    };
  }
  
  private adjustWeekdaysForNonHolidays(startDate: DateTime, today: DateTime, nonHolidays: NonHoliday[]): number {
    let weekdays = this.calculateWeekdaysBetween(startDate, today);
  
    nonHolidays.forEach(nonHoliday => {
      const nhDate = DateTime.fromISO(nonHoliday.date);
      if (nhDate >= startDate && nhDate <= today) {
        if (nhDate.weekday >= 1 && nhDate.weekday <= 5) {
          weekdays--; // Restar un día hábil si el día no hábil está dentro del rango
        }
      }
    });
  
    return weekdays;
  }
  

  private calculateWeekdaysBetween(startDate: DateTime, endDate: DateTime): number {
    let count = 0;
    let currentDate = startDate.startOf('day');
    while (currentDate <= endDate.startOf('day')) {
      if (currentDate.weekday >= 1 && currentDate.weekday <= 5) {
        count++;
      }
      currentDate = currentDate.plus({ days: 1 });
    }
    return count;
  }

  private async calculateTotalNonHolidayDays(nonHolidays: NonHoliday[], currentDate: Date): Promise<number> {
    return nonHolidays.reduce(async (sumPromise, nh) => {
      const sum = await sumPromise;
      const nhDate = DateTime.fromISO(nh.date);
      if (nhDate <= DateTime.fromJSDate(currentDate)) {
        return sum + (nhDate <= DateTime.fromJSDate(currentDate) ? 1 : 0);
      }
      return sum;
    }, Promise.resolve(0));
  }
  private calculateVacationDays(yearsOfService: number): number {
    if (yearsOfService >= 20) {
      return 30; // 30 días de vacaciones para empleados con 20 años o más de servicio
    } else if (yearsOfService >= 10) {
      return 20; // 20 días de vacaciones para empleados con 10 a 19 años de servicio
    } else if (yearsOfService >= 5) {
      return 15; // 15 días de vacaciones para empleados con 5 a 9 años de servicio
    } else {
      return 0; // Menos de 5 años de servicio no otorgan días de vacaciones
    }
  }
  
}
