import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { HolidayPeriodService } from './holydayperiod.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { DateTime } from 'luxon';
import { firstValueFrom, lastValueFrom } from 'rxjs';

@Injectable()
export class VacationService {
  constructor(
    private readonly userService: UserService,
    private readonly holidayPeriodService: HolidayPeriodService,
    private readonly nonHolidayService: NonHolidayService,
  ) {}

  async getVacationInfo(carnetIdentidad: string, year: number) {
    // Obtener los datos del usuario
    const userObservable = this.userService.findByCarnet(carnetIdentidad);
    const user = await lastValueFrom(userObservable);
    console.log('User Data:', user);

    // Obtener los períodos de receso y días no hábiles
    const holidays = await this.holidayPeriodService.getHolidayPeriods(year);
    const nonHolidays = await this.nonHolidayService.getNonHolidayDays(year);

    const startDate = DateTime.fromISO(user.fechaIngreso);
    const endDate = DateTime.local(year, 12, 31);
    const diff = endDate.diff(startDate, ['years', 'months']);
    const yearsOfService = Math.floor(diff.years);
    const monthsOfService = Math.floor(diff.months);

    const userVacationDays = this.calculateVacationDays(yearsOfService);
    const totalNonHolidayDays = nonHolidays.reduce((sum, nh) => sum + nh.days, 0);

    const holidayDetails = holidays.map(holiday => {
      const startDate = DateTime.fromJSDate(holiday.startDate);
      const endDate = DateTime.fromJSDate(holiday.endDate);
      const weekdays = this.calculateWeekdaysBetween(startDate, endDate);
      return { ...holiday, weekdays };
    });

    const totalHolidayDays = holidayDetails.reduce((sum, holiday) => sum + holiday.weekdays, 0);

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
      holidayDetails,
    };
  }

  private calculateVacationDays(yearsOfService: number): number {
    if (yearsOfService >= 20) {
      return 30;
    } else if (yearsOfService >= 10) {
      return 20;
    } else if (yearsOfService >= 5) {
      return 15;
    } else {
      return 0;
    }
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
  async getCurrentYearVacationData(carnetIdentidad: string, year: number): Promise<any> {
    const user = await firstValueFrom(this.userService.findByCarnet(carnetIdentidad));
    
    if (!user) {
      throw new BadRequestException(`Usuario con carnet de identidad ${carnetIdentidad} no encontrado`);
    }

    const startDate = DateTime.fromISO(user.fechaIngreso);
    const today = DateTime.now();
    const yearsOfService = today.year - startDate.year;
    const monthsOfService = today.month - startDate.month;
    const userVacationDays = 30; // Asignar según la antigüedad

    const holidays = await this.holidayPeriodService.getHolidayPeriods(year);
    const nonHolidays = await this.nonHolidayService.getNonHolidayDays(year);

    let totalHolidayDays = 0;
    const holidayDetails = holidays.map(holiday => {
      let weekdays = 0;
      const endDate = DateTime.fromJSDate(holiday.endDate);
      if (endDate <= today) {
        weekdays = this.countWeekdays(holiday.startDate, holiday.endDate);
      } else if (DateTime.fromJSDate(holiday.startDate) <= today && endDate > today) {
        weekdays = this.countWeekdays(holiday.startDate, today.toJSDate());
      }
      totalHolidayDays += weekdays;
      return {
        ...holiday,
        weekdays
      };
    });

    const totalNonHolidayDays = nonHolidays.reduce((sum, nh) => sum + nh.days, 0);

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

  private countWeekdays(startDate: Date, endDate: Date): number {
    let weekdays = 0;
    let currentDate = DateTime.fromJSDate(startDate).startOf('day');
    const end = DateTime.fromJSDate(endDate).startOf('day');

    while (currentDate <= end) {
      if (currentDate.weekday >= 1 && currentDate.weekday <= 5) {
        weekdays++;
      }
      currentDate = currentDate.plus({ days: 1 });
    }

    return weekdays;
  }
}
