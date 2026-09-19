export interface QaidaLineConfig {
  rangeLabel: string;
  lineOptions: string[];
}

export interface QaidaSectionConfig {
  sectionName: string; // e.g. "Main", "Test", "Exercise", "Examples"
  lineConfig: QaidaLineConfig;
}

export interface QaidaLessonEntry {
  lessonNumber?: number;
  lessonName: string; // e.g. "Lesson 1: THE ALPHABETS"
  sections: QaidaSectionConfig[];
}

export interface NoraniQaidaPage {
  pageNumber: number;
  pageLabel: string;
  lessons: QaidaLessonEntry[];
}

// Helper to generate line options from range
function makeLines(start: number, end: number, labelPrefix = "Lines"): QaidaLineConfig {
  const rangeLabel = `${labelPrefix} ${start}-${end}`;
  const lineOptions = [`${labelPrefix} ${start}-${end}`];
  for (let i = start; i <= end; i++) {
    lineOptions.push(`Line ${i}`);
  }
  return { rangeLabel, lineOptions };
}

function makeSingleLine(label: string): QaidaLineConfig {
  return { rangeLabel: label, lineOptions: [label] };
}

/**
 * Single source of truth for NORANI QAIDA DATA
 * Total Pages: 30
 * Total Lessons: 26
 * Structure: Qaida → Page → Lesson → Section → Line
 */
export const NORANI_QAIDA_STRUCTURE: NoraniQaidaPage[] = [
  // Page 1: Cover
  {
    pageNumber: 1,
    pageLabel: "Page 1: Cover",
    lessons: [
      {
        lessonName: "Cover",
        sections: [
          {
            sectionName: "Cover",
            lineConfig: makeSingleLine("Cover Page")
          }
        ]
      }
    ]
  },

  // Page 2: Lesson 1: THE ALPHABETS (Main: Lines 1-6)
  {
    pageNumber: 2,
    pageLabel: "Page 2",
    lessons: [
      {
        lessonNumber: 1,
        lessonName: "Lesson 1: THE ALPHABETS",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 6)
          }
        ]
      }
    ]
  },

  // Page 3: Lesson 1: THE ALPHABETS (Test: Lines 1-6)
  {
    pageNumber: 3,
    pageLabel: "Page 3",
    lessons: [
      {
        lessonNumber: 1,
        lessonName: "Lesson 1: THE ALPHABETS",
        sections: [
          {
            sectionName: "Test",
            lineConfig: makeLines(1, 6)
          }
        ]
      }
    ]
  },

  // Page 4: Lesson 1: THE ALPHABETS (Test: Lines 7-12)
  {
    pageNumber: 4,
    pageLabel: "Page 4",
    lessons: [
      {
        lessonNumber: 1,
        lessonName: "Lesson 1: THE ALPHABETS",
        sections: [
          {
            sectionName: "Test",
            lineConfig: makeLines(7, 12)
          }
        ]
      }
    ]
  },

  // Page 5: Lesson 2: HALF SHAPES (Main: Lines 1-4, Exercise: Lines 1-4)
  {
    pageNumber: 5,
    pageLabel: "Page 5",
    lessons: [
      {
        lessonNumber: 2,
        lessonName: "Lesson 2: HALF SHAPES",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 4)
          }
        ]
      }
    ]
  },

  // Page 6: Lesson 3: JOINING LETTERS (Main: Lines 1-8)
  {
    pageNumber: 6,
    pageLabel: "Page 6",
    lessons: [
      {
        lessonNumber: 3,
        lessonName: "Lesson 3: JOINING LETTERS",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 8)
          }
        ]
      }
    ]
  },

  // Page 7: Lesson 3: JOINING LETTERS (Main: Lines 9-20)
  {
    pageNumber: 7,
    pageLabel: "Page 7",
    lessons: [
      {
        lessonNumber: 3,
        lessonName: "Lesson 3: JOINING LETTERS",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(9, 20)
          }
        ]
      }
    ]
  },

  // Page 8: Lesson 4: FATHAH / ZABAR (Main: Lines 1-4, Exercise: Lines 1-4)
  {
    pageNumber: 8,
    pageLabel: "Page 8",
    lessons: [
      {
        lessonNumber: 4,
        lessonName: "Lesson 4: FATHAH / ZABAR",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 4)
          }
        ]
      }
    ]
  },

  // Page 9: Lesson 5: KASRAH / ZAIR (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 9,
    pageLabel: "Page 9",
    lessons: [
      {
        lessonNumber: 5,
        lessonName: "Lesson 5: KASRAH / ZAIR",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 10: Lesson 6: DAMMAH / PESH (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 10,
    pageLabel: "Page 10",
    lessons: [
      {
        lessonNumber: 6,
        lessonName: "Lesson 6: DAMMAH / PESH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 11: Lesson 6: DAMMAH / PESH (Exercise: Lines 6-14)
  {
    pageNumber: 11,
    pageLabel: "Page 11",
    lessons: [
      {
        lessonNumber: 6,
        lessonName: "Lesson 6: DAMMAH / PESH",
        sections: [
          {
            sectionName: "Exercise",
            lineConfig: makeLines(6, 14)
          }
        ]
      }
    ]
  },

  // Page 12: Lesson 7: FATHATAIN / DOW ZABAR (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 12,
    pageLabel: "Page 12",
    lessons: [
      {
        lessonNumber: 7,
        lessonName: "Lesson 7: FATHATAIN / DOW ZABAR",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 13: Lesson 8: KASRAHTAIN / DOW ZAIR (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 13,
    pageLabel: "Page 13",
    lessons: [
      {
        lessonNumber: 8,
        lessonName: "Lesson 8: KASRAHTAIN / DOW ZAIR",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 14: Lesson 9: DAMMATAIN / DOW PESH (Main: Lines 1-4, Exercise: Lines 1-4)
  {
    pageNumber: 14,
    pageLabel: "Page 14",
    lessons: [
      {
        lessonNumber: 9,
        lessonName: "Lesson 9: DAMMATAIN / DOW PESH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 4)
          }
        ]
      }
    ]
  },

  // Page 15:
  // - Lesson 10: STANDING FATHAH/ ZABAR (Main: Lines 1-4)
  // - Lesson 11: STANDING KASRAH & DAMMAH (Main: Lines 1-2, Exercise: Lines 1-2)
  {
    pageNumber: 15,
    pageLabel: "Page 15",
    lessons: [
      {
        lessonNumber: 10,
        lessonName: "Lesson 10: STANDING FATHAH/ ZABAR",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          }
        ]
      },
      {
        lessonNumber: 11,
        lessonName: "Lesson 11: STANDING KASRAH & DAMMAH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 2)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 2)
          }
        ]
      }
    ]
  },

  // Page 16: Lesson 12: JAZAM/ SAKOON (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 16,
    pageLabel: "Page 16",
    lessons: [
      {
        lessonNumber: 12,
        lessonName: "Lesson 12: JAZAM/ SAKOON",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 17: Lesson 12: JAZAM/ SAKOON (Exercise: Lines 6-14)
  {
    pageNumber: 17,
    pageLabel: "Page 17",
    lessons: [
      {
        lessonNumber: 12,
        lessonName: "Lesson 12: JAZAM/ SAKOON",
        sections: [
          {
            sectionName: "Exercise",
            lineConfig: makeLines(6, 14)
          }
        ]
      }
    ]
  },

  // Page 18: Lesson 13: ALIF MADDA (Main: Lines 1-3, Exercise: Lines 1-6)
  {
    pageNumber: 18,
    pageLabel: "Page 18",
    lessons: [
      {
        lessonNumber: 13,
        lessonName: "Lesson 13: ALIF MADDA",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 3)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 6)
          }
        ]
      }
    ]
  },

  // Page 19: Lesson 14: WAO MADDAH (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 19,
    pageLabel: "Page 19",
    lessons: [
      {
        lessonNumber: 14,
        lessonName: "Lesson 14: WAO MADDAH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 20: Lesson 15: YA-MADDAH (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 20,
    pageLabel: "Page 20",
    lessons: [
      {
        lessonNumber: 15,
        lessonName: "Lesson 15: YA-MADDAH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 21: Lesson 16: SAKOON/ WAO LEEN (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 21,
    pageLabel: "Page 21",
    lessons: [
      {
        lessonNumber: 16,
        lessonName: "Lesson 16: SAKOON/ WAO LEEN",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 22: Lesson 17: YA-LEEN (Main: Lines 1-4, Exercise: Lines 1-5)
  {
    pageNumber: 22,
    pageLabel: "Page 22",
    lessons: [
      {
        lessonNumber: 17,
        lessonName: "Lesson 17: YA-LEEN",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 5)
          }
        ]
      }
    ]
  },

  // Page 23:
  // - Lesson 18: TASHDEED (Main: Lines 1-5)
  // - Lesson 19: EXERCISE TASHDEED (Exercise: Lines 1-4)
  {
    pageNumber: 23,
    pageLabel: "Page 23",
    lessons: [
      {
        lessonNumber: 18,
        lessonName: "Lesson 18: TASHDEED",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 5)
          }
        ]
      },
      {
        lessonNumber: 19,
        lessonName: "Lesson 19: EXERCISE TASHDEED",
        sections: [
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 4)
          }
        ]
      }
    ]
  },

  // Page 24: Lesson 19: EXERCISE TASHDEED (Exercise: Lines 5-13)
  {
    pageNumber: 24,
    pageLabel: "Page 24",
    lessons: [
      {
        lessonNumber: 19,
        lessonName: "Lesson 19: EXERCISE TASHDEED",
        sections: [
          {
            sectionName: "Exercise",
            lineConfig: makeLines(5, 13)
          }
        ]
      }
    ]
  },

  // Page 25: Lesson 20: MADD & MADDA LETTERS (Main: Lines 1-8)
  {
    pageNumber: 25,
    pageLabel: "Page 25",
    lessons: [
      {
        lessonNumber: 20,
        lessonName: "Lesson 20: MADD & MADDA LETTERS",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 8)
          }
        ]
      }
    ]
  },

  // Page 26:
  // - Lesson 21: IDGHAM (Main: Lines 1-6)
  // - Lesson 22: IKPAH & GUNNAH (Main: Lines 1-2)
  {
    pageNumber: 26,
    pageLabel: "Page 26",
    lessons: [
      {
        lessonNumber: 21,
        lessonName: "Lesson 21: IDGHAM",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 6)
          }
        ]
      },
      {
        lessonNumber: 22,
        lessonName: "Lesson 22: IKPAH & GUNNAH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 2)
          }
        ]
      }
    ]
  },

  // Page 27:
  // - Lesson 22: IKPAH & GUNNAH (Main: Lines 3-6)
  // - Lesson 23: IQLAAB (Main: Lines 1-4)
  {
    pageNumber: 27,
    pageLabel: "Page 27",
    lessons: [
      {
        lessonNumber: 22,
        lessonName: "Lesson 22: IKPAH & GUNNAH",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(3, 6)
          }
        ]
      },
      {
        lessonNumber: 23,
        lessonName: "Lesson 23: IQLAAB",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 4)
          }
        ]
      }
    ]
  },

  // Page 28: Lesson 24: EXERCISE WAQF (Examples: Lines 1-2, Exercise: Lines 1-6)
  {
    pageNumber: 28,
    pageLabel: "Page 28",
    lessons: [
      {
        lessonNumber: 24,
        lessonName: "Lesson 24: EXERCISE WAQF",
        sections: [
          {
            sectionName: "Examples",
            lineConfig: makeLines(1, 2)
          },
          {
            sectionName: "Exercise",
            lineConfig: makeLines(1, 6)
          }
        ]
      }
    ]
  },

  // Page 29: Lesson 24: EXERCISE WAQF (Exercise: Lines 7-16)
  {
    pageNumber: 29,
    pageLabel: "Page 29",
    lessons: [
      {
        lessonNumber: 24,
        lessonName: "Lesson 24: EXERCISE WAQF",
        sections: [
          {
            sectionName: "Exercise",
            lineConfig: makeLines(7, 16)
          }
        ]
      }
    ]
  },

  // Page 30:
  // - Lesson 25: LONG MADD (Main: Lines 1-3)
  // - Lesson 26: تَمّت (Main: Lines 1-3)
  {
    pageNumber: 30,
    pageLabel: "Page 30",
    lessons: [
      {
        lessonNumber: 25,
        lessonName: "Lesson 25: LONG MADD",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 3)
          }
        ]
      },
      {
        lessonNumber: 26,
        lessonName: "Lesson 26: تَمّت (Tammat)",
        sections: [
          {
            sectionName: "Main",
            lineConfig: makeLines(1, 3)
          }
        ]
      }
    ]
  }
];

// Helper lookup functions for cascading dropdowns: Qaida → Page → Lesson → Section → Line
export function getQaidaPage(pageNumber: number): NoraniQaidaPage | undefined {
  return NORANI_QAIDA_STRUCTURE.find(p => p.pageNumber === pageNumber);
}

export function getLessonsForPage(pageNumber: number): QaidaLessonEntry[] {
  const page = getQaidaPage(pageNumber);
  return page ? page.lessons : [];
}

export function getSectionsForLesson(pageNumber: number, lessonName: string): QaidaSectionConfig[] {
  const lessons = getLessonsForPage(pageNumber);
  const matchedLesson = lessons.find(l => l.lessonName === lessonName) || lessons[0];
  return matchedLesson ? matchedLesson.sections : [];
}

export function getLinesForSection(pageNumber: number, lessonName: string, sectionName: string): string[] {
  const sections = getSectionsForLesson(pageNumber, lessonName);
  const matchedSection = sections.find(s => s.sectionName === sectionName) || sections[0];
  return matchedSection ? matchedSection.lineConfig.lineOptions : [];
}

// Backward compatibility helper
export const NOORANI_QAIDA_PAGES = NORANI_QAIDA_STRUCTURE.map(p => ({
  pageNumber: p.pageNumber,
  title: p.lessons.map(l => l.lessonName).join(' & '),
  sections: p.lessons.flatMap(l => l.sections.map(s => `${l.lessonName} - ${s.sectionName}`)),
  exercises: p.lessons.flatMap(l => l.sections.flatMap(s => s.lineConfig.lineOptions))
}));
