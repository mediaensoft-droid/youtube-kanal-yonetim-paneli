import { describe, it, expect } from "vitest";
import { describeActivity, ACTION_LABELS, ACTIVITY_TYPES, FIELD_LABELS } from "@/lib/activity";

describe("describeActivity", () => {
  it("channel.update lists the changed fields in Turkish", () => {
    const result = describeActivity({
      action: "channel.update",
      entityName: "Test Kanalı",
      details: { changedFields: ["categoryIds", "notes"] },
    });
    expect(result.subject).toBe("Test Kanalı");
    expect(result.text).toBe("kanalını düzenledi (kategoriler, notlar)");
  });

  it("channel.update with no changed fields still produces a sentence", () => {
    const result = describeActivity({
      action: "channel.update",
      entityName: "Test Kanalı",
      details: { changedFields: [] },
    });
    expect(result.text).toBe("kanalını düzenledi");
  });

  it("channel.status to passive", () => {
    const result = describeActivity({
      action: "channel.status",
      entityName: "Test Kanalı",
      details: { from: "active", to: "passive" },
    });
    expect(result.text).toBe("kanalını pasife aldı");
  });

  it("channel.status to active", () => {
    const result = describeActivity({
      action: "channel.status",
      entityName: "Test Kanalı",
      details: { from: "passive", to: "active" },
    });
    expect(result.text).toBe("kanalını aktife aldı");
  });

  it("channel.status to planned", () => {
    const result = describeActivity({
      action: "channel.status",
      entityName: "Test Kanalı",
      details: { from: "active", to: "planned" },
    });
    expect(result.text).toBe("kanalını planlanana taşıdı");
  });

  it("channel.create with planned status", () => {
    const result = describeActivity({
      action: "channel.create",
      entityName: "Test Kanalı",
      details: { status: "planned" },
    });
    expect(result.text).toBe("kanalını planlanan kanal olarak ekledi");
  });

  it("channel.create without planned status", () => {
    const result = describeActivity({
      action: "channel.create",
      entityName: "Test Kanalı",
      details: { status: "active" },
    });
    expect(result.text).toBe("kanalını ekledi");
  });

  it("schedule.upsert builds the date + status sentence", () => {
    const result = describeActivity({
      action: "schedule.upsert",
      entityName: "Test Kanalı",
      details: { date: "2026-09-12", status: "published" },
    });
    expect(result.subject).toBe("Test Kanalı");
    expect(result.text).toBe("için 2026-09-12 tarihini yayınlandı yaptı");
  });

  it("schedule.upsert maps planned/skipped status labels", () => {
    expect(
      describeActivity({
        action: "schedule.upsert",
        entityName: "Test Kanalı",
        details: { date: "2026-09-12", status: "planned" },
      }).text
    ).toBe("için 2026-09-12 tarihini planlandı yaptı");
    expect(
      describeActivity({
        action: "schedule.upsert",
        entityName: "Test Kanalı",
        details: { date: "2026-09-12", status: "skipped" },
      }).text
    ).toBe("için 2026-09-12 tarihini atlandı yaptı");
  });

  it("schedule.upsert without a date skips it without leaving a double space", () => {
    const result = describeActivity({
      action: "schedule.upsert",
      entityName: "Test Kanalı",
      details: { status: "published" },
    });
    expect(result.text).toBe("için tarihini yayınlandı yaptı");
    expect(result.text).not.toMatch(/ {2}/);
  });

  it("auth.login has no subject", () => {
    const result = describeActivity({ action: "auth.login", entityName: null, details: {} });
    expect(result.subject).toBeNull();
    expect(result.text).toBe("sisteme giriş yaptı");
  });

  it("unknown action falls back to the raw action string", () => {
    const result = describeActivity({ action: "something.unknown", entityName: "X", details: {} });
    expect(result.text).toBe("something.unknown");
  });

  it("member.status reflects disabled vs active", () => {
    expect(
      describeActivity({
        action: "member.status",
        entityName: "Ali",
        details: { from: "active", to: "disabled" },
      }).text
    ).toBe("adlı personeli pasife aldı");
    expect(
      describeActivity({
        action: "member.status",
        entityName: "Ali",
        details: { from: "disabled", to: "active" },
      }).text
    ).toBe("adlı personeli aktife aldı");
  });

  it("ACTION_LABELS and ACTIVITY_TYPES cover every known action", () => {
    const allActions = Object.values(ACTIVITY_TYPES).flat();
    for (const action of allActions) {
      expect(ACTION_LABELS[action]).toBeTruthy();
    }
  });

  it("FIELD_LABELS maps every channel.update field", () => {
    expect(FIELD_LABELS.categoryIds).toBe("kategoriler");
    expect(FIELD_LABELS.conceptIds).toBe("konseptler");
    expect(FIELD_LABELS.languages).toBe("diller");
    expect(FIELD_LABELS.countries).toBe("ülkeler");
    expect(FIELD_LABELS.notes).toBe("notlar");
    expect(FIELD_LABELS.publishDays).toBe("yayın günleri");
    expect(FIELD_LABELS.publishTime).toBe("yayın saati");
    expect(FIELD_LABELS.url).toBe("URL");
  });
});
