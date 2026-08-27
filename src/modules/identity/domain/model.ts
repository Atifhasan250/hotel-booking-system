export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";

export interface User {
  id: string;
  publicId: string;
  displayName: string;
  normalizedEmail: string;
  passwordHash: string;
  status: UserStatus;
  contactVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt?: Date;
  replacedById?: string;
  securityMetadata: {
    userAgentHash?: string;
    ipHash?: string;
  };
}

export type IdentityTokenPurpose = "VERIFY_CONTACT" | "RESET_PASSWORD";

export interface IdentityToken {
  id: string;
  userId: string;
  purpose: IdentityTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt?: Date;
}

export type VendorRole = "MEMBER" | "OWNER";

export type VendorPermission =
  | "vendor:bookings:read"
  | "vendor:finance:read"
  | "vendor:inventory:manage"
  | "vendor:members:manage"
  | "vendor:properties:manage";

export interface VendorMembership {
  vendorId: string;
  role: VendorRole;
  permissions: VendorPermission[];
  status: "ACTIVE" | "SUSPENDED";
}

export type AdminPermission =
  | "admin:audit:read"
  | "admin:bookings:manage"
  | "admin:content:manage"
  | "admin:finance:manage"
  | "admin:identity:manage"
  | "admin:marketplace:read"
  | "admin:vendors:approve";

export interface ActorContext {
  userId: string;
  customerId: string;
  vendorMemberships: VendorMembership[];
  adminPermissions: AdminPermission[];
  superAdmin: boolean;
}
