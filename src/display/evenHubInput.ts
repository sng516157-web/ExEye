import {
  EventSourceType,
  OsEventTypeList,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";

/** Normalize temple/ring/display input into an OsEventTypeList code. */
export function resolveInputEventType(event: EvenHubEvent): number | undefined {
  const raw = readRawEventType(event);
  const normalized = normalizeEventType(raw);
  if (normalized !== undefined) {
    return normalized;
  }

  const sys = readRecord(event.sysEvent) ?? readSysFromJson(event.jsonData);
  if (sys) {
    if (sysEventHasImu(sys)) {
      return OsEventTypeList.IMU_DATA_REPORT;
    }

    if (isHardwareTouchSource(sys.eventSource ?? sys.EventSource)) {
      return OsEventTypeList.CLICK_EVENT;
    }
  }

  return undefined;
}

function readRawEventType(event: EvenHubEvent): unknown {
  const e = event as Record<string, unknown>;
  const listEvt = readRecord(event.listEvent);
  const textEvt = readRecord(event.textEvent);
  const sysEvt = readRecord(event.sysEvent);

  const fromTyped =
    listEvt?.eventType ??
    listEvt?.EventType ??
    textEvt?.eventType ??
    textEvt?.EventType;

  if (fromTyped !== undefined && fromTyped !== null) {
    return fromTyped;
  }

  if (sysEvt) {
    const fromSys = sysEvt.eventType ?? sysEvt.EventType;
    if (fromSys !== undefined && fromSys !== null) {
      return fromSys;
    }

    if (sysEventHasImu(sysEvt)) {
      return OsEventTypeList.IMU_DATA_REPORT;
    }

    // Temple / ring presses often arrive as sysEvent without eventType.
    return OsEventTypeList.CLICK_EVENT;
  }

  const json = readRecord(event.jsonData);
  if (json) {
    const fromJson =
      json.eventType ??
      json.EventType ??
      json.event_type ??
      readRecord(json.sysEvent)?.eventType ??
      readRecord(json.textEvent)?.eventType ??
      readRecord(json.listEvent)?.eventType;

    if (fromJson !== undefined && fromJson !== null) {
      return fromJson;
    }
  }

  return e.eventType ?? e.EventType;
}

function readSysFromJson(
  jsonData: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const json = readRecord(jsonData);
  if (!json) {
    return undefined;
  }

  return readRecord(json.sysEvent) ?? json;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function sysEventHasImu(sysEvt: Record<string, unknown>): boolean {
  return sysEvt.imuData !== undefined || sysEvt.IMU_Data !== undefined;
}

function isHardwareTouchSource(source: unknown): boolean {
  if (source === undefined || source === null) {
    return false;
  }

  if (typeof source === "number") {
    return (
      source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R ||
      source === EventSourceType.TOUCH_EVENT_FROM_RING ||
      source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L
    );
  }

  if (typeof source === "string") {
    const value = source.toUpperCase();
    return (
      value.includes("GLASSES") ||
      value.includes("RING") ||
      value.includes("TOUCH")
    );
  }

  return false;
}

function normalizeEventType(rawEventType: unknown): number | undefined {
  if (typeof rawEventType === "number") {
    if (rawEventType >= 0 && rawEventType <= 8) {
      return rawEventType;
    }
    return undefined;
  }

  if (typeof rawEventType === "string") {
    const trimmed = rawEventType.trim();
    if (/^\d+$/.test(trimmed)) {
      return normalizeEventType(Number(trimmed));
    }

    const value = trimmed.toUpperCase();
    if (value.includes("DOUBLE")) {
      return OsEventTypeList.DOUBLE_CLICK_EVENT;
    }
    if (value.includes("SCROLL_TOP")) {
      return OsEventTypeList.SCROLL_TOP_EVENT;
    }
    if (value.includes("SCROLL_BOTTOM")) {
      return OsEventTypeList.SCROLL_BOTTOM_EVENT;
    }
    if (value.includes("CLICK")) {
      return OsEventTypeList.CLICK_EVENT;
    }
    if (value.includes("IMU")) {
      return OsEventTypeList.IMU_DATA_REPORT;
    }
  }

  return undefined;
}
