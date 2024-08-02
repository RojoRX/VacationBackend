import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { HolidayPeriodService } from './holydayperiod.service';
import { NonHolidayService } from './nonholiday.service';
import { User } from 'src/interfaces/user.interface';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';

@Injectable()
export class VacationService {
  constructor(
    private readonly userService: UserService,
    private readonly holidayService: HolidayPeriodService,
    private readonly nonHolidayService: NonHolidayService
  ) {}

  async calculateRemainingVacationDays(carnetIdentidad: string): Promise<any> {
    const user = await this.userService.findByCarnet(carnetIdentidad).toPromise();
    if (!user) {
      throw new Error('User not found');
    }

    const today = new Date();
    const startDate = new Date(user.fechaIngreso);
    const { yearsOfService, monthsOfService } = this.calculateYearsAndMonthsOfService(startDate, today);
    const userVacationDays = this.calculateVacationDaysByService(yearsOfService);

    const holidays = await this.holidayService.getHolidayPeriods(today.getFullYear());
    const nonHolidays = await this.nonHolidayService.getNonHolidayDays(today.getFullYear());

    const { totalHolidaysDays, effectiveHolidayDays } = await this.calculateHolidayDays(holidays, nonHolidays, today.getFullYear());

    const remainingVacationDays = userVacationDays - effectiveHolidayDays;

    return {
      carnetIdentidad: carnetIdentidad,
      totalHolidaysDays: totalHolidaysDays,
      effectiveHolidayDays: effectiveHolidayDays,
      userVacationDays: userVacationDays,
      remainingVacationDays: remainingVacationDays,
      yearsOfService: yearsOfService,
      monthsOfService: monthsOfService,
      nonHolidayDays: nonHolidays
    };
  }

  private calculateYearsAndMonthsOfService(startDate: Date, today: Date): { yearsOfService: number, monthsOfService: number } {
    let years = today.getFullYear() - startDate.getFullYear();
    let months = today.getMonth() - startDate.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return { yearsOfService: years, monthsOfService: months };
  }

  private calculateVacationDaysByService(yearsOfService: number): number {
    if (yearsOfService < 1) return 0; // Cambiado a 0 días para menos de 1 año de servicio
    if (yearsOfService < 5) return 15;
    if (yearsOfService < 10) return 20;
    return 30;
  }

  private async calculateHolidayDays(holidays: any[], nonHolidayDays: number, year: number): Promise<{ totalHolidaysDays: number, effectiveHolidayDays: number }> {
    let totalDays = 0;
    let effectiveDays = 0;
    const holidayDetails = [];
  
    for (const holiday of holidays) {
      if (holiday.year === year) {
        let start = new Date(holiday.startDate);
        let end = new Date(holiday.endDate);
  
        // Validar que start y end sean fechas válidas
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.error(`Invalid date for holiday: ${holiday.name}`);
          continue;
        }
  
        // Asegúrate de que la hora esté en el inicio del día
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
  
        if (end < start) continue;
  
        let holidayDays = 0;
        const currentHolidayDetails = {
          name: holiday.name,
          startDate: holiday.startDate,
          endDate: holiday.endDate,
          days: 0
        };
  
        console.log(`Processing holiday: ${holiday.name}`);
        console.log(`Start Date: ${start}`);
        console.log(`End Date: ${end}`);
  
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          if (date.getDay() >= 1 && date.getDay() <= 5) { // Check if the day is Monday to Friday
            holidayDays++;
            currentHolidayDetails.days++;
            console.log(`Counting day: ${date.toDateString()}`);
          }
        }
  
        // Update effectiveDays to exclude non-holiday days
        const nonHolidayDaysInRange = await this.getNonHolidayDaysInRange(start, end, nonHolidayDays);
        effectiveDays += holidayDays;
        
        // Exclude non-holiday days from total
        totalDays += holidayDays;
        
        if (holidayDays > 0) {
          holidayDetails.push(currentHolidayDetails);
        }
  
        console.log(`Total Days for ${holiday.name}: ${holidayDays}`);
      }
    }
  
    console.log(`Total Holidays Days: ${totalDays}`);
    console.log(`Effective Holidays Days: ${effectiveDays - nonHolidayDays}`);
  
    return { totalHolidaysDays: totalDays, effectiveHolidayDays: effectiveDays - nonHolidayDays };
  }

  private async getNonHolidayDaysInRange(start: Date, end: Date, nonHolidayDays: number): Promise<number> {
    // Simplified version; should calculate days in range if needed
    return nonHolidayDays;
  }
}
