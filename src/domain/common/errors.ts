export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class SKUMappingError extends DomainError {
  constructor(message: string, public readonly inputText: string) {
    super(message, 'SKU_MAPPING_ERROR');
    this.name = 'SKUMappingError';
  }
}

export class PricingError extends DomainError {
  constructor(message: string, public readonly skuCode?: string) {
    super(message, 'PRICING_ERROR');
    this.name = 'PricingError';
  }
}

export class ConfigurationError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class DataNotFoundError extends DomainError {
  constructor(message: string, public readonly entityType: string, public readonly identifier: string) {
    super(message, 'DATA_NOT_FOUND');
    this.name = 'DataNotFoundError';
  }
}
