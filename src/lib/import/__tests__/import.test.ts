import { describe, expect, it } from "vitest";
import { extractTextFromImage } from "../image";
import { parseJsonOfferings } from "../json";
import { parseTable } from "../parser";
import { emptyDraftRow, resultToDraftRows, reviewDraftRows } from "../review";

const HEADER = "کد درس,نام درس,گروه,تعداد واحد,ظرفیت,جنسیت,استاد,زمان کلاس,زمان امتحان";

describe("offerings import", () => {
  it("parses CSV with Persian digits and multiple meetings", () => {
    const result = parseTable(
      `${HEADER}\nPHY201,الکترومغناطیس ۱,۰۱,۳,۳۰,مختلط,دکتر امینی,شنبه 08:00-10:00 و دوشنبه 08:00-10:00,2026/06/20 09:00-11:00`,
    );
    expect(result.ambiguous).toHaveLength(0);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({ courseCode: "PHY201", groupNumber: "01", units: 3 });
    expect(result.sections[0]!.meetings).toHaveLength(2);
    expect(result.sections[0]!.exam?.date).toBe("2026-06-20");
  });

  it("parses English day names in bilingual manual and CSV imports", () => {
    const result = parseTable(
      `${HEADER}\nPHY101,General Physics,01,3,25,mixed,Professor Curie,Saturday 08:00-10:00 and Monday 12:30-14:00,2026/06/20 09:00-11:00`,
    );
    expect(result.ambiguous).toHaveLength(0);
    expect(result.sections[0]!.meetings).toEqual([
      { day: 0, start: "08:00", end: "10:00" },
      { day: 2, start: "12:30", end: "14:00" },
    ]);
  });

  it("keeps validated Jalali exam labels for conflict checking and display", () => {
    const result = parseTable(
      `${HEADER}\nPHY101,فیزیک عمومی,01,3,25,مختلط,استاد,شنبه 08:00-10:00,1405/03/30 09:00-11:00`,
    );
    const review = reviewDraftRows(resultToDraftRows(result));
    expect(review.canConfirm).toBe(true);
    expect(review.validSections[0]!.exam?.date).toBe("1405/03/30");
  });

  it("keeps uncertain rows editable rather than silently accepting them", () => {
    const result = parseTable(`${HEADER}\nPHY201,الکترومغناطیس,01,3,30,مختلط,استاد,نامعلوم,ندارد`);
    const rows = resultToDraftRows(result);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.uncertainty).toBe("unreadable_class_time");
    expect(reviewDraftRows(rows).canConfirm).toBe(false);

    rows[0]!.classSchedule = "شنبه 08:00-10:00";
    const fixed = reviewDraftRows(rows);
    expect(fixed.canConfirm).toBe(true);
    expect(fixed.validSections).toHaveLength(1);
  });

  it("accepts flat and nested JSON section formats", () => {
    const flat = parseJsonOfferings(
      JSON.stringify([
        {
          courseCode: "PHY101",
          courseName: "فیزیک عمومی",
          groupNumber: "1",
          units: 3,
          professor: "استاد",
          meetings: [{ day: 0, start: "08:00", end: "10:00" }],
        },
      ]),
    );
    expect(flat.sections).toHaveLength(1);

    const nested = parseJsonOfferings(
      JSON.stringify({
        courses: [
          {
            code: "PHY102",
            name: "فیزیک دو",
            credits: 3,
            sections: [
              {
                group: "2",
                instructor: "استاد دوم",
                schedule: "دوشنبه 10:00-12:00",
              },
            ],
          },
        ],
      }),
    );
    expect(nested.sections).toHaveLength(1);
    expect(nested.sections[0]!.courseCode).toBe("PHY102");
  });

  it("blocks duplicate sections and conflicting metadata during review", () => {
    const first = {
      ...emptyDraftRow(1),
      courseCode: "PHY101",
      courseName: "Physics",
      groupNumber: "1",
      classSchedule: "شنبه 08:00-10:00",
    };
    const duplicate = { ...first, id: "duplicate", courseName: "Different name" };
    const reviewed = reviewDraftRows([first, duplicate]);
    expect(reviewed.canConfirm).toBe(false);
    expect(reviewed.rowErrors[first.id]).toEqual(
      expect.arrayContaining(["duplicate_section", "conflicting_course_metadata"]),
    );
    expect(reviewed.rowErrors[duplicate.id]).toEqual(
      expect.arrayContaining(["duplicate_section", "conflicting_course_metadata"]),
    );
  });

  it("requires at least one valid row before confirmation", () => {
    expect(reviewDraftRows([]).canConfirm).toBe(false);
    expect(reviewDraftRows([emptyDraftRow()]).canConfirm).toBe(false);
  });

  it("rejects non-image files before attempting extraction", async () => {
    const file = new File(["not an image"], "courses.txt", { type: "text/plain" });
    await expect(extractTextFromImage(file)).rejects.toThrow("not_an_image");
  });

  it("reports when no local or configured image extractor is available", async () => {
    const runtime = globalThis as typeof globalThis & { TextDetector?: unknown };
    const original = runtime.TextDetector;
    delete runtime.TextDetector;
    try {
      const file = new File(["image bytes"], "courses.png", { type: "image/png" });
      await expect(extractTextFromImage(file)).rejects.toThrow("image_extraction_unavailable");
    } finally {
      if (original) runtime.TextDetector = original;
    }
  });
});
