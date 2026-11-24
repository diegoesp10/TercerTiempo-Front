export interface ChoiceOption<V extends string = string> {
  value: V;
  label: string;
  // Reclamo junto al nombre («2 meses gratis»).
  badge?: string;
  // Icono de Font Awesome delante del nombre (registrado en icons.ts).
  icon?: string;
}
