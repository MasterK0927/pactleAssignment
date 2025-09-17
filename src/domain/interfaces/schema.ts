export interface CSVSchema {
  name: string;
  description: string;
  version: string;

  columnMappings: {
    item?: string;
    description: string;
    quantity?: string;
    uom?: string;

    sku_code?: string;
    material?: string; 
    size?: string;
    gauge?: string;
    color?: string;
    price?: string;
  };

  defaults: {
    quantity?: number;
    uom?: string;
  };

  transformations?: {
    generateItemNumbers?: boolean;
    useSkuAsDescription?: boolean;
    combineFields?: Array<{
      targetField: string;
      sourceFields: string[];
      separator?: string;
    }>;
  };

  validation?: {
    requiredColumns: string[];
    skipEmptyRows?: boolean;
    minColumns?: number; 
  };
}

export const PREDEFINED_SCHEMAS: { [key: string]: CSVSchema } = {
  default: {
    name: "Default RFQ Format",
    description: "Standard RFQ format with Item, Desc, Qty, UOM columns",
    version: "1.0",
    columnMappings: {
      item: "item",
      description: "desc",
      quantity: "qty",
      uom: "uom"
    },
    defaults: {
      quantity: 1,
      uom: "PC"
    },
    validation: {
      requiredColumns: ["desc"],
      skipEmptyRows: true,
      minColumns: 2
    }
  },

  price_master: {
    name: "Price Master Catalog",
    description: "Product catalog format that gets converted to RFQ items",
    version: "1.0",
    columnMappings: {
      sku_code: "sku_code",
      description: "description",
      material: "material",
      size: "size_od_mm",
      gauge: "gauge",
      color: "colour",
      uom: "uom",
      price: "rate_inr"
    },
    defaults: {
      quantity: 1,
      uom: "PC"
    },
    transformations: {
      generateItemNumbers: true,
      useSkuAsDescription: false,
      combineFields: [
        {
          targetField: "description",
          sourceFields: ["description", "size_od_mm", "material"],
          separator: " "
        }
      ]
    },
    validation: {
      requiredColumns: ["sku_code", "description"],
      skipEmptyRows: true,
      minColumns: 3
    }
  },

  extended: {
    name: "Extended RFQ Format",
    description: "RFQ format with additional product details",
    version: "1.0",
    columnMappings: {
      item: "item",
      description: "description",
      quantity: "quantity",
      uom: "uom",
      material: "material",
      size: "size",
      gauge: "gauge",
      color: "color"
    },
    defaults: {
      quantity: 1,
      uom: "PC"
    },
    validation: {
      requiredColumns: ["description"],
      skipEmptyRows: true,
      minColumns: 2
    }
  }
};