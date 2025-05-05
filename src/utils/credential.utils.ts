import { BadRequestException } from '@nestjs/common';

/**
 * Genera un username basado en el nombre completo y CI
 * @param fullName - Nombre completo del usuario
 * @param ci - Carnet de identidad
 * @returns Username generado (ej: jperez4567)
 */
export function generateUsername(fullName: string, ci: string): string {
  if (!fullName || !ci) {
    throw new BadRequestException('Nombre completo y CI son requeridos');
  }

  // Normalizar el nombre (eliminar espacios extras)
  const normalizedName = fullName.trim().replace(/\s+/g, ' ');
  const names = normalizedName.split(' ');
  
  let usernamePart = '';
  
  if (names.length >= 2) {
    // Primera letra del primer nombre + apellido completo
    usernamePart = `${names[0].charAt(0).toLowerCase()}${names[names.length - 1].toLowerCase()}`;
  } else {
    // Si solo tiene un nombre, usar las primeras 4 letras
    usernamePart = names[0].toLowerCase().slice(0, 4);
  }
  
  // Limpiar caracteres especiales
  usernamePart = usernamePart
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]/g, ''); // Eliminar caracteres no alfanuméricos
  
  // Tomar últimos 4 dígitos del CI
  const ciDigits = ci.replace(/\D/g, ''); // Eliminar todo lo que no sea dígito
  if (ciDigits.length < 4) {
    throw new BadRequestException('El CI debe tener al menos 4 dígitos');
  }
  const ciSuffix = ciDigits.slice(-4);
  
  return `${usernamePart}${ciSuffix}`.slice(0, 20); // Limitar longitud máxima
}

/**
 * Genera una contraseña memorable de 8-12 caracteres
 * @returns Contraseña generada (ej: felizsol123)
 */
export function generateMemorablePassword(): string {
  const adjectives = [
    'feliz', 'azul', 'rapido', 'fuerte', 'calma', 'verde', 
    'grande', 'suave', 'alto', 'bajo', 'nuevo', 'lindo'
  ];
  const nouns = [
    'sol', 'luna', 'rio', 'mar', 'monte', 'cielo', 
    'arbol', 'viento', 'piedra', 'flor', 'libro', 'casa'
  ];
  const specialChars = ['!', '@', '#', '$', '%', '&', '*'];
  
  // Seleccionar elementos aleatorios
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(10 + Math.random() * 90); // Número entre 10-99
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  // Crear patrón: Adjetivo + Nombre + Número + Caracter especial
  const password = `${adj}${noun}${number}${specialChar}`;
  
  // Asegurar longitud entre 8-12 caracteres
  return password.length > 12 ? password.slice(0, 12) : password;
}
