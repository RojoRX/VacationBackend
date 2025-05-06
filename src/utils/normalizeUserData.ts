import { CreateUserDto } from "src/dto/create-user.dto";

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

export function normalizeUserData(dto: CreateUserDto): CreateUserDto {
  return {
    ...dto,
    email: dto.email?.toLowerCase(),
    fullName: normalizeText(dto.fullName),
    profesion: normalizeText(dto.profesion),
    position: normalizeText(dto.position),
    // puedes normalizar también otros campos si lo necesitas
  };
}
