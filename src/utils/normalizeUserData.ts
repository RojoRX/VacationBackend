import { CreateUserDto } from "src/dto/create-user.dto";
import { UpdateUserDto } from "src/dto/update-user.dto";

export function normalizeText(text: string): string {
  return text
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // elimina espacios dobles
    .replace(/\b\w/g, char => char.toUpperCase()); // capitaliza cada palabra
}

export function normalizeUpper(text: string): string {
  return text?.trim().toUpperCase();
}

export function normalizeUserData(dto: Partial<CreateUserDto & UpdateUserDto>): Partial<CreateUserDto & UpdateUserDto> {
  return {
    ...dto,
    email: dto.email?.toLowerCase(),
    fullName: dto.fullName ? normalizeText(dto.fullName) : undefined,
    position: dto.position ? normalizeText(dto.position) : undefined,
    // professionId y academicUnitId no necesitan normalización
  };
}
