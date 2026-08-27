export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: AuditOutcome;
  requestId: string;
  occurredAt: Date;
  metadata: Record<string, string | number | boolean>;
}

export interface AuditEventWriter {
  append(event: AuditEvent): Promise<void>;
}
