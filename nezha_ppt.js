const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Nezha Presentation";
pres.title = "Nezha and His Moral Dilemma";

// ===================== COLORS =====================
const C = {
  darkBg: "1A0A0A",       // deep crimson-black
  creamBg: "FFF8F0",      // warm cream
  cardBg: "F5ECE0",       // lighter cream for cards
  red: "C41E3A",          // Nezha's red sash
  gold: "D4A017",         // divine gold
  white: "FFFFFF",
  darkText: "3D2B1F",     // warm dark brown
  mutedText: "8B7355",    // muted brown
  cardDark: "2D1810",     // dark card bg
  creamAlt: "FDF6EE",     // alternate cream
};

// Helper to create fresh shadow object each time
const cardShadow = () => ({
  type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.10,
});

// ===================== SLIDE 1: TITLE =====================
(() => {
  const slide = pres.addSlide();
  slide.background = { color: C.darkBg };

  // Decorative top gold line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.04, fill: { color: C.gold },
  });

  // Decorative bottom gold line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.585, w: 10, h: 0.04, fill: { color: C.gold },
  });

  // Large red accent block (left side)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.5, w: 0.06, h: 2.6, fill: { color: C.red },
  });

  // Main title
  slide.addText("Nezha and His", {
    x: 1.0, y: 1.5, w: 8.5, h: 0.9,
    fontSize: 40, fontFace: "Georgia", color: C.white, bold: true,
    align: "left", valign: "middle", margin: 0,
  });
  slide.addText("Moral Dilemma", {
    x: 1.0, y: 2.2, w: 8.5, h: 0.9,
    fontSize: 40, fontFace: "Georgia", color: C.gold, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Subtitle
  slide.addText("哪吒 — A Story from Chinese Mythology", {
    x: 1.0, y: 3.3, w: 8.5, h: 0.5,
    fontSize: 16, fontFace: "Calibri", color: C.mutedText,
    align: "left", valign: "middle", margin: 0,
  });

  // Small decorative accent text
  slide.addText("A Pre-Class Presentation", {
    x: 1.0, y: 4.0, w: 8.5, h: 0.4,
    fontSize: 13, fontFace: "Calibri", color: C.mutedText, italic: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Decorative small diamond shape at bottom right
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 8.8, y: 4.85, w: 0.22, h: 0.22,
    fill: { color: C.gold }, rotate: 45,
  });
})();

// ===================== SLIDE 2: WHO IS NEZHA =====================
(() => {
  const slide = pres.addSlide();
  slide.background = { color: C.creamBg };

  // Top accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.red },
  });

  // Left vertical decorative bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.8, w: 0.06, h: 0.6, fill: { color: C.gold },
  });

  // Section title
  slide.addText("Who Is Nezha?", {
    x: 0.85, y: 0.7, w: 8.5, h: 0.8,
    fontSize: 30, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Content card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: 1.7, w: 8.3, h: 3.2,
    fill: { color: C.white }, shadow: cardShadow(),
  });

  // Red left border on card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: 1.7, w: 0.12, h: 3.2, fill: { color: C.red },
  });

  // Bullet content
  slide.addText([
    {
      text: "Born from the Mo Wan (Lotus Root)",
      options: { bullet: true, breakLine: true, fontSize: 18, fontFace: "Calibri", color: C.darkText, bold: true },
    },
    {
      text: "People believed the Mo Wan would bring disaster",
      options: { bullet: true, breakLine: true, fontSize: 18, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "Nezha was expected to become evil in the future",
      options: { bullet: true, breakLine: true, fontSize: 18, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "Many people were afraid of him and did not trust him",
      options: { bullet: true, fontSize: 18, fontFace: "Calibri", color: C.darkText },
    },
  ], {
    x: 1.3, y: 1.9, w: 7.4, h: 2.8,
    valign: "top", align: "left", paraSpaceAfter: 8,
  });
})();

// ===================== SLIDE 3: THE MORAL DILEMMA =====================
(() => {
  const slide = pres.addSlide();
  slide.background = { color: C.creamBg };

  // Top accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.red },
  });

  // Left vertical decorative bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.8, w: 0.06, h: 0.6, fill: { color: C.gold },
  });

  // Section title
  slide.addText("The Moral Dilemma", {
    x: 0.85, y: 0.7, w: 8.5, h: 0.8,
    fontSize: 30, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Subtitle / context
  slide.addText("When people expected him to become a monster, Nezha faced two choices...", {
    x: 0.85, y: 1.5, w: 8.3, h: 0.5,
    fontSize: 15, fontFace: "Calibri", color: C.mutedText, italic: true,
    align: "left", valign: "middle", margin: 0,
  });

  // ====== LEFT CARD: Accept ======
  const cardY = 2.2, cardH = 2.8, cardW = 3.8;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: cardY, w: cardW, h: cardH,
    fill: { color: C.white }, shadow: cardShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: cardY, w: cardW, h: 0.06, fill: { color: C.darkText },
  });
  slide.addText("Accept Fate", {
    x: 1.1, y: cardY + 0.15, w: 3.3, h: 0.5,
    fontSize: 20, fontFace: "Georgia", color: C.darkText, bold: true,
    align: "left", valign: "middle", margin: 0,
  });
  slide.addText([
    {
      text: "Accept what others thought about him",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "Become the monster they expected",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "Express his anger freely",
      options: { bullet: false, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
  ], {
    x: 1.1, y: cardY + 0.75, w: 3.3, h: 2.0,
    valign: "top", align: "left", paraSpaceAfter: 6,
  });

  // VS text - with decorative circle
  slide.addShape(pres.shapes.OVAL, {
    x: 4.53, y: cardY + 1.0, w: 0.94, h: 0.7,
    fill: { color: C.red },
  });
  slide.addText("vs", {
    x: 4.53, y: cardY + 1.0, w: 0.94, h: 0.7,
    fontSize: 22, fontFace: "Georgia", color: C.white, bold: true, italic: true,
    align: "center", valign: "middle", margin: 0,
  });

  // ====== RIGHT CARD: Fight ======
  const rightX = 5.35;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rightX, y: cardY, w: cardW, h: cardH,
    fill: { color: C.white }, shadow: cardShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rightX, y: cardY, w: cardW, h: 0.06, fill: { color: C.red },
  });
  slide.addText("Fight Fate", {
    x: rightX + 0.25, y: cardY + 0.15, w: 3.3, h: 0.5,
    fontSize: 20, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });
  slide.addText([
    {
      text: "Fight against what others believed",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "Prove that he was a good person",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "Protect the innocent",
      options: { bullet: false, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
  ], {
    x: rightX + 0.25, y: cardY + 0.75, w: 3.3, h: 2.0,
    valign: "top", align: "left", paraSpaceAfter: 6,
  });
})();

// ===================== SLIDE 4: DIFFICULT CHOICES =====================
(() => {
  const slide = pres.addSlide();
  slide.background = { color: C.creamBg };

  // Top accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.red },
  });

  // Left vertical decorative bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.8, w: 0.06, h: 0.6, fill: { color: C.gold },
  });

  // Section title
  slide.addText("Two Paths, Both Difficult", {
    x: 0.85, y: 0.7, w: 8.5, h: 0.8,
    fontSize: 30, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Subtitle
  slide.addText("Whichever path he chose, the cost was heavy...", {
    x: 0.85, y: 1.5, w: 8.3, h: 0.5,
    fontSize: 15, fontFace: "Calibri", color: C.mutedText, italic: true,
    align: "left", valign: "middle", margin: 0,
  });

  // ====== LEFT CARD: Choose Kindness ======
  const cardY = 2.2, cardH = 2.8, cardW = 3.85;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: cardY, w: cardW, h: cardH,
    fill: { color: C.white }, shadow: cardShadow(),
  });
  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: cardY, w: cardW, h: 0.08, fill: { color: "5B8C5A" }, // muted green
  });

  slide.addText("If He Chose Kindness", {
    x: 1.1, y: cardY + 0.2, w: 3.4, h: 0.5,
    fontSize: 19, fontFace: "Georgia", color: "5B8C5A", bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Content
  slide.addText([
    {
      text: "He would still face misunderstanding",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "He would experience loneliness",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "No one would trust him despite his good deeds",
      options: { bullet: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
  ], {
    x: 1.1, y: cardY + 0.8, w: 3.4, h: 2.0,
    valign: "top", align: "left", paraSpaceAfter: 6,
  });

  // ====== RIGHT CARD: Choose Revenge ======
  const rightX = 5.3;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rightX, y: cardY, w: cardW, h: cardH,
    fill: { color: C.white }, shadow: cardShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: rightX, y: cardY, w: cardW, h: 0.08, fill: { color: C.red },
  });

  slide.addText("If He Chose Revenge", {
    x: rightX + 0.25, y: cardY + 0.2, w: 3.4, h: 0.5,
    fontSize: 19, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText([
    {
      text: "He could finally express his anger",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "He would prove them right about him",
      options: { bullet: true, breakLine: true, fontSize: 15, fontFace: "Calibri", color: C.darkText },
    },
    {
      text: "But innocent people would be hurt",
      options: { bullet: true, fontSize: 15, fontFace: "Calibri", color: C.red, bold: true },
    },
  ], {
    x: rightX + 0.25, y: cardY + 0.8, w: 3.4, h: 2.0,
    valign: "top", align: "left", paraSpaceAfter: 6,
  });
})();

// ===================== SLIDE 5: NEZHA'S CHOICE =====================
(() => {
  const slide = pres.addSlide();
  slide.background = { color: C.creamBg };

  // Top accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.red },
  });

  // Left vertical decorative bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.8, w: 0.06, h: 0.6, fill: { color: C.gold },
  });

  // Section title
  slide.addText("Nezha's Choice", {
    x: 0.85, y: 0.7, w: 8.5, h: 0.8,
    fontSize: 30, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Highlight card - big statement
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: 1.7, w: 8.3, h: 3.2,
    fill: { color: C.white }, shadow: cardShadow(),
  });

  // Gold left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.85, y: 1.7, w: 0.08, h: 3.2, fill: { color: C.gold },
  });

  // Big highlight text
  slide.addText("Nezha chose to", {
    x: 1.3, y: 1.9, w: 7.4, h: 0.6,
    fontSize: 20, fontFace: "Calibri", color: C.mutedText,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText("protect others", {
    x: 1.3, y: 2.3, w: 7.4, h: 0.8,
    fontSize: 36, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText("instead of hurting them.", {
    x: 1.3, y: 3.0, w: 7.4, h: 0.5,
    fontSize: 20, fontFace: "Calibri", color: C.darkText,
    align: "left", valign: "middle", margin: 0,
  });

  // Separator line
  slide.addShape(pres.shapes.LINE, {
    x: 1.3, y: 3.7, w: 5, h: 0,
    line: { color: C.gold, width: 1.5, dashType: "dash" },
  });

  // Quote
  slide.addText("\u201CPeople are not defined by their birth,\u201D", {
    x: 1.3, y: 3.9, w: 7.4, h: 0.4,
    fontSize: 16, fontFace: "Calibri", color: C.darkText, italic: true,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText("nor by what others think of them.", {
    x: 1.3, y: 4.2, w: 7.4, h: 0.4,
    fontSize: 16, fontFace: "Calibri", color: C.darkText, italic: true,
    align: "left", valign: "middle", margin: 0,
  });
})();

// ===================== SLIDE 6: LESSON & THANK YOU =====================
(() => {
  const slide = pres.addSlide();
  slide.background = { color: C.darkBg };

  // Decorative top gold line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.04, fill: { color: C.gold },
  });

  // Decorative bottom gold line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.585, w: 10, h: 0.04, fill: { color: C.gold },
  });

  // Red accent block (left)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 0.8, w: 0.08, h: 4.0, fill: { color: C.red },
  });

  // Section label
  slide.addText("The Lesson", {
    x: 1.0, y: 0.8, w: 8.5, h: 0.5,
    fontSize: 14, fontFace: "Calibri", color: C.gold,
    align: "left", valign: "middle", margin: 0, charSpacing: 4,
  });

  // Main quote
  slide.addText("Even when the world", {
    x: 1.0, y: 1.5, w: 8.5, h: 0.7,
    fontSize: 28, fontFace: "Georgia", color: C.white, bold: false,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText("misunderstands us,", {
    x: 1.0, y: 2.1, w: 8.5, h: 0.7,
    fontSize: 28, fontFace: "Georgia", color: C.gold, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText("we should still choose", {
    x: 1.0, y: 2.7, w: 8.5, h: 0.7,
    fontSize: 28, fontFace: "Georgia", color: C.white,
    align: "left", valign: "middle", margin: 0,
  });

  slide.addText("what is right.", {
    x: 1.0, y: 3.3, w: 8.5, h: 0.7,
    fontSize: 28, fontFace: "Georgia", color: C.red, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Separator
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 1.0, y: 4.2, w: 2.5, h: 0.03, fill: { color: C.gold },
  });

  // Thank you
  slide.addText("Thank You", {
    x: 1.0, y: 4.4, w: 8.5, h: 0.6,
    fontSize: 22, fontFace: "Georgia", color: C.white, bold: true,
    align: "left", valign: "middle", margin: 0,
  });

  // Decorative diamond
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 8.8, y: 4.8, w: 0.25, h: 0.25,
    fill: { color: C.gold }, rotate: 45,
  });
})();

// ===================== WRITE FILE =====================
pres.writeFile({ fileName: "/home/fmpos/Nezha_Moral_Dilemma.pptx" })
  .then(() => console.log("DONE: Nezha_Moral_Dilemma.pptx"))
  .catch(err => console.error("ERROR:", err));
