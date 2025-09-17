import { Money } from '../../domain/value-objects/Money';

describe('Money', () => {
  describe('constructor', () => {
    it('should create money with valid amount', () => {
      const money = new Money(100.50);
      expect(money.amount).toBe(100.50);
      expect(money.currency).toBe('INR');
    });

    it('should create money with custom currency', () => {
      const money = new Money(100, 'USD');
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    it('should round to 2 decimal places', () => {
      const money = new Money(100.999);
      expect(money.amount).toBe(101);
    });

    it('should throw error for negative amount', () => {
      expect(() => new Money(-10)).toThrow('Amount cannot be negative');
    });
  });

  describe('arithmetic operations', () => {
    it('should add money correctly', () => {
      const money1 = new Money(100);
      const money2 = new Money(50);
      const result = money1.add(money2);
      expect(result.amount).toBe(150);
    });

    it('should subtract money correctly', () => {
      const money1 = new Money(100);
      const money2 = new Money(30);
      const result = money1.subtract(money2);
      expect(result.amount).toBe(70);
    });

    it('should multiply by factor correctly', () => {
      const money = new Money(100);
      const result = money.multiply(2.5);
      expect(result.amount).toBe(250);
    });

    it('should divide by factor correctly', () => {
      const money = new Money(100);
      const result = money.divide(4);
      expect(result.amount).toBe(25);
    });

    it('should calculate percentage correctly', () => {
      const money = new Money(1000);
      const result = money.percentage(18);
      expect(result.amount).toBe(180);
    });

    it('should throw error when dividing by zero', () => {
      const money = new Money(100);
      expect(() => money.divide(0)).toThrow('Cannot divide by zero');
    });

    it('should throw error when adding different currencies', () => {
      const money1 = new Money(100, 'INR');
      const money2 = new Money(50, 'USD');
      expect(() => money1.add(money2)).toThrow('Currency mismatch');
    });
  });

  describe('comparison operations', () => {
    it('should check equality correctly', () => {
      const money1 = new Money(100);
      const money2 = new Money(100);
      const money3 = new Money(200);
      
      expect(money1.equals(money2)).toBe(true);
      expect(money1.equals(money3)).toBe(false);
    });

    it('should compare greater than correctly', () => {
      const money1 = new Money(100);
      const money2 = new Money(50);
      
      expect(money1.isGreaterThan(money2)).toBe(true);
      expect(money2.isGreaterThan(money1)).toBe(false);
    });

    it('should compare less than correctly', () => {
      const money1 = new Money(50);
      const money2 = new Money(100);
      
      expect(money1.isLessThan(money2)).toBe(true);
      expect(money2.isLessThan(money1)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should create zero money', () => {
      const zero = Money.zero();
      expect(zero.amount).toBe(0);
      expect(zero.currency).toBe('INR');
    });

    it('should create money from rupees', () => {
      const money = Money.fromRupees(500);
      expect(money.amount).toBe(500);
      expect(money.currency).toBe('INR');
    });

    it('should convert to string correctly', () => {
      const money = new Money(1234.56);
      expect(money.toString()).toBe('INR 1234.56');
    });

    it('should convert to JSON correctly', () => {
      const money = new Money(100, 'USD');
      const json = money.toJSON();
      expect(json).toEqual({ amount: 100, currency: 'USD' });
    });
  });
});
