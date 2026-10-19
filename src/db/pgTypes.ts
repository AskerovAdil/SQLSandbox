/** Имена наиболее частых типов PostgreSQL по OID. Остальные показываются как oid N. */
const TYPE_NAMES: Record<number, string> = {
  16: 'bool',
  17: 'bytea',
  20: 'int8',
  21: 'int2',
  23: 'int4',
  25: 'text',
  114: 'json',
  142: 'xml',
  700: 'float4',
  701: 'float8',
  1005: 'int2[]',
  1007: 'int4[]',
  1009: 'text[]',
  1042: 'bpchar',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
}

export function typeName(typeId: number): string {
  return TYPE_NAMES[typeId] ?? `oid ${String(typeId)}`
}
