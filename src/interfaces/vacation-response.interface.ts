export interface VacationResponse {
  carnetIdentidad: string;
  totalHolidaysDays: number;
  userVacationDays: number;
  remainingVacationDays: number;
  holidayDetails: Array<{
    name: string;
    startDate: string;
    endDate: string;
    days: number;
  }>;
}
