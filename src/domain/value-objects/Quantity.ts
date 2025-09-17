export type UnitOfMeasure = 'M' | 'PC' | 'PACK100' | 'COIL';

export class Quantity {
  private readonly _value: number;
  private readonly _unit: UnitOfMeasure;

  constructor(value: number, unit: UnitOfMeasure) {
    if (value <= 0) {
      throw new Error('Quantity must be positive');
    }
    this._value = value;
    this._unit = unit;
  }

  get value(): number {
    return this._value;
  }

  get unit(): UnitOfMeasure {
    return this._unit;
  }

  convertToMeters(coilLengthM?: number): Quantity {
    if (this._unit === 'COIL' && coilLengthM) {
      return new Quantity(this._value * coilLengthM, 'M');
    }
    if (this._unit === 'M') {
      return this;
    }
    throw new Error(`Cannot convert ${this._unit} to meters`);
  }

  convertToCoils(coilLengthM: number): Quantity {
    if (this._unit === 'M') {
      const coils = Math.ceil(this._value / coilLengthM);
      return new Quantity(coils, 'COIL');
    }
    if (this._unit === 'COIL') {
      return this;
    }
    throw new Error(`Cannot convert ${this._unit} to coils`);
  }

  multiply(factor: number): Quantity {
    return new Quantity(this._value * factor, this._unit);
  }

  equals(other: Quantity): boolean {
    return this._value === other._value && this._unit === other._unit;
  }

  toString(): string {
    return `${this._value} ${this._unit}`;
  }

  toJSON(): { value: number; unit: string } {
    return {
      value: this._value,
      unit: this._unit,
    };
  }

  static fromString(quantityStr: string, unit: UnitOfMeasure): Quantity {
    const value = parseFloat(quantityStr);
    if (isNaN(value)) {
      throw new Error(`Invalid quantity: ${quantityStr}`);
    }
    return new Quantity(value, unit);
  }
}
