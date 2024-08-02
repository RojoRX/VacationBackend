import { Injectable } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { HolidayPeriodService } from './holydayperiod.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { DateTime } from 'luxon';
import { lastValueFrom } from 'rxjs';

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
}
