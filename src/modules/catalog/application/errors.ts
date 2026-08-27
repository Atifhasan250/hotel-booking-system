export class CatalogAuthorizationError extends Error {
  constructor() {
    super("Catalog authorization denied");
    this.name = "CatalogAuthorizationError";
  }
}

export class CatalogConflictError extends Error {
  constructor(message = "Catalog state conflict") {
    super(message);
    this.name = "CatalogConflictError";
  }
}

export class CatalogNotFoundError extends Error {
  constructor() {
    super("Catalog resource not found");
    this.name = "CatalogNotFoundError";
  }
}

export class CatalogIncompleteError extends Error {
  constructor(readonly missing: string[]) {
    super("Publish checklist is incomplete");
    this.name = "CatalogIncompleteError";
  }
}

export class CatalogRateLimitError extends Error {
  constructor() {
    super("Catalog mutation rate limit exceeded");
    this.name = "CatalogRateLimitError";
  }
}
