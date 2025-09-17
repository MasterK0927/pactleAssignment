# Design Decisions and Thresholds

This document outlines the key design decisions, thresholds, and rules implemented in the Pactle Quote Generation System.

## 1. Architecture Decisions

### 1.1 SOLID Principles Implementation

- **Single Responsibility Principle**: Each class has a single responsibility (e.g., `EmailRFQParser` only parses email RFQs)
- **Open/Closed Principle**: New parsers can be added without modifying existing code
- **Liskov Substitution Principle**: All parsers implement the `IRFQParser` interface
- **Interface Segregation**: Interfaces are specific to their use cases (e.g., `IPriceMasterRepository` vs `ITaxRepository`)
- **Dependency Inversion**: High-level modules depend on abstractions, not concrete implementations

### 1.2 Domain-Driven Design

- **Entities**: Core domain objects like `RFQ`, `Quote`, `SKU`
- **Value Objects**: Immutable objects like `Money` and `Quantity`
- **Repositories**: Data access abstractions for `PriceMaster`, `Tax`, and `Alias` data
- **Services**: Business logic encapsulated in service classes
- **Factories**: Creation logic for complex objects

## 2. SKU Mapping Rules

### 2.1 Matching Thresholds

- **Minimum Score Threshold**: `0.7` (70% confidence)
- **Minimum Margin Threshold**: `0.1` (10% gap between top and second candidate)
- **Size Tolerance**: `2mm` (default, can be overridden per SKU)

### 2.2 Scoring Algorithm

The SKU matching algorithm uses a weighted combination of:

1. **Hard Constraints** (must match):
   - Product family match: +0.3
   - Size match within tolerance: +0.25 * (1 - sizeDiff/tolerance)
   - Material match: +0.2 (or +0.15 for alternative material)

2. **Soft Constraints** (boost score):
   - Gauge match: +0.1
   - Color match: +0.05
   - Description similarity: +0.15 * similarity score
   - Alias match: +alias boost value (typically 0.1-0.2)

3. **Penalties**:
   - Material mismatch: -0.1
   - Gauge mismatch: -0.05

### 2.3 String Similarity

String similarity uses a combined approach:
- 50% Jaro-Winkler similarity (good for typos and transpositions)
- 30% Token-based similarity (good for word order changes)
- 20% Levenshtein similarity (good for edit distance)

## 3. Business Rules

### 3.1 Default Values

- **Default Material for Corrugated Pipes**: `PP`
- **Default Gauge for PVC Conduit**: `L` (Light)
- **Default Validity Period**: `30 days`
- **Default Lead Time**: `7 days`
- **Default GST Rate**: `18%`

### 3.2 Freight Rules

- **Threshold**: ₹50,000
- **Below Threshold**: ₹1,000 freight charge
- **Above Threshold**: Free freight (₹0)
- **Special Rules**: Custom freight or waived freight based on RFQ terms

### 3.3 Unit Conversions

- **Coil to Meter Conversion**: Based on `coil_length_m` in price master
  - NFC16: 50m per coil
  - NFC20: 50m per coil
  - NFC25: 25m per coil
  - NFC32: 25m per coil
  - NFC40: 20m per coil
  - NFC50: 15m per coil

### 3.4 Rounding Rules

- **Line Amounts**: Rounded to 2 decimal places
- **Tax Amounts**: Rounded to nearest rupee
- **Quantities**: Coil to meter conversions rounded up

## 4. Performance Considerations

### 4.1 Data Loading

- CSV data is loaded lazily on first access
- Data is cached in memory after first load
- Repositories provide `reload()` method for refreshing data

### 4.2 Idempotency

- Idempotency key is generated using SHA-256 hash of:
  - Buyer ID
  - RFQ raw input hash
  - RFQ source

### 4.3 Concurrency

- All operations are stateless and thread-safe
- No shared mutable state between requests

## 5. Error Handling

### 5.1 Error Types

- **ValidationError**: Input validation failures
- **SKUMappingError**: Failures during SKU mapping
- **PricingError**: Errors in price calculation
- **DataNotFoundError**: Required data not found
- **ConfigurationError**: System configuration issues

### 5.2 Error Responses

- HTTP 400: Validation errors
- HTTP 422: Business rule violations
- HTTP 500: System errors

## 6. Extension Points

The system is designed to be extended in the following ways:

1. **New Product Families**: Add to price_master.csv and sku_alias.csv
2. **New RFQ Formats**: Implement new parser class implementing `IRFQParser`
3. **New Output Formats**: Add new generator to `OutputService`
4. **Custom Pricing Rules**: Extend `PricingService` or add rule engine
5. **New Tax Structures**: Update tax repository and calculation logic

## 7. Testing Strategy

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **Acceptance Tests**: Validate against business requirements
- **End-to-End Tests**: Test complete API flows
- **Coverage Target**: ≥85% line coverage
