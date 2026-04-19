export interface Pattern {
    id: string;
    name: string;
    description: string;
    tags: string[];
    code: string;
}

export const PATTERNS: Pattern[] = [
    // ─── Light-theme patterns (1-16) ───────────────────────────────────

    {
        id: 'title-slide',
        name: 'Title Slide',
        description:
            'Full background color with large centered title and subtitle. Use as the opening slide of any presentation.',
        tags: ['title', 'opening', 'intro', 'cover', 'hero', 'start'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.primary };
slide.addText("Presentation Title", {
  x: 0.5, y: 1.5, w: 9, h: 1.2,
  fontSize: 40, fontFace: fonts.header, color: C.white, bold: true, align: "center"
});
slide.addText("Subtitle goes here", {
  x: 1.5, y: 2.9, w: 7, h: 0.8,
  fontSize: 20, fontFace: fonts.body, color: C.white, align: "center"
});`,
    },

    {
        id: 'section-divider',
        name: 'Section Divider',
        description:
            'Colored left strip with section number and title on the right side. Use to separate major sections of the deck.',
        tags: ['section', 'divider', 'separator', 'chapter', 'break', 'number'],
        code: `const slide = pres.addSlide();
slide.addShape(shapes.RECTANGLE, { x: 0, y: 0, w: 3.5, h: 5.625, fill: { color: C.primary } });
slide.addText("01", {
  x: 0.5, y: 1.5, w: 2.5, h: 1.2,
  fontSize: 64, fontFace: fonts.header, color: C.white, bold: true
});
slide.addText("Section Title", {
  x: 4.2, y: 2.0, w: 5.3, h: 1.0,
  fontSize: 32, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addText("Brief description of this section", {
  x: 4.2, y: 3.2, w: 5.3, h: 0.8,
  fontSize: 16, fontFace: fonts.body, color: C.medium
});`,
    },

    {
        id: 'bullet-points',
        name: 'Bullet Points',
        description:
            'Title with a bullet list and accent line separator. Use for listing key points, takeaways, or simple lists.',
        tags: ['bullets', 'list', 'points', 'items', 'key', 'takeaways'],
        code: `const slide = pres.addSlide();
slide.addText("Key Points", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addShape(shapes.RECTANGLE, { x: 0.5, y: 1.0, w: 1.5, h: 0.05, fill: { color: C.primary } });
const bullets = ["First important point here", "Second key insight to share", "Third actionable takeaway"];
bullets.forEach((text, i) => {
  slide.addText(text, {
    x: 1.0, y: 1.4 + i * 0.9, w: 8.0, h: 0.7,
    fontSize: 18, fontFace: fonts.body, color: C.dark, bullet: { code: "2022" }
  });
});`,
    },

    {
        id: 'two-column',
        name: 'Two-Column Content',
        description:
            'Split layout with content cards on both sides. Use for comparisons, dual concepts, or paired information.',
        tags: ['two', 'column', 'split', 'dual', 'side-by-side', 'cards', 'compare'],
        code: `const slide = pres.addSlide();
slide.addText("Title", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
// Left column card
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.3, w: 4.2, h: 3.8,
  fill: { color: C.subtle }, rectRadius: 0.15, shadow: makeCardShadow()
});
slide.addText("Left Content", {
  x: 0.8, y: 1.5, w: 3.6, h: 0.5,
  fontSize: 18, fontFace: fonts.header, color: C.primary, bold: true
});
slide.addText("Description for the left side with supporting details.", {
  x: 0.8, y: 2.1, w: 3.6, h: 2.5,
  fontSize: 14, fontFace: fonts.body, color: C.medium
});
// Right column card
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 5.3, y: 1.3, w: 4.2, h: 3.8,
  fill: { color: C.subtle }, rectRadius: 0.15, shadow: makeCardShadow()
});
slide.addText("Right Content", {
  x: 5.6, y: 1.5, w: 3.6, h: 0.5,
  fontSize: 18, fontFace: fonts.header, color: C.primary, bold: true
});
slide.addText("Description for the right side with supporting details.", {
  x: 5.6, y: 2.1, w: 3.6, h: 2.5,
  fontSize: 14, fontFace: fonts.body, color: C.medium
});`,
    },

    {
        id: 'three-cards',
        name: 'Three Cards / Features',
        description:
            'Three equal-width feature cards in a row with icons. Use for feature highlights, pillars, or triple comparisons.',
        tags: ['three', 'cards', 'features', 'pillars', 'icons', 'grid', 'row'],
        code: `const slide = pres.addSlide();
slide.addText("Features", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
const features = [
  { icon: "FaRocket", title: "Fast", desc: "Lightning quick performance" },
  { icon: "FaShieldAlt", title: "Secure", desc: "Enterprise-grade security" },
  { icon: "FaCogs", title: "Flexible", desc: "Highly configurable" },
];
features.forEach((f, i) => {
  const x = 0.5 + i * 3.1;
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x, y: 1.3, w: 2.8, h: 3.5,
    fill: { color: C.white }, rectRadius: 0.15, shadow: makeCardShadow(),
    line: { color: C.subtle, width: 1 }
  });
  const iconPng = iconToBase64Png(f.icon, "#" + C.primary, 64);
  slide.addImage({ data: "image/png;base64," + iconPng, x: x + 0.9, y: 1.6, w: 1.0, h: 1.0 });
  slide.addText(f.title, {
    x: x + 0.2, y: 2.8, w: 2.4, h: 0.5,
    fontSize: 18, fontFace: fonts.header, color: C.dark, bold: true, align: "center"
  });
  slide.addText(f.desc, {
    x: x + 0.2, y: 3.3, w: 2.4, h: 1.0,
    fontSize: 13, fontFace: fonts.body, color: C.medium, align: "center"
  });
});`,
    },

    {
        id: 'stats-metrics',
        name: 'Stats / Metrics',
        description:
            'Large KPI numbers with labels. Use for data-driven slides showing key performance indicators or important statistics.',
        tags: ['stats', 'metrics', 'kpi', 'numbers', 'data', 'performance', 'big-number'],
        code: `const slide = pres.addSlide();
slide.addText("Key Metrics", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
const metrics = [
  { value: "99.9%", label: "Uptime" },
  { value: "50ms", label: "Latency" },
  { value: "10M+", label: "Users" },
];
metrics.forEach((m, i) => {
  const x = 0.8 + i * 3.0;
  slide.addText(m.value, {
    x, y: 2.0, w: 2.6, h: 1.0,
    fontSize: 44, fontFace: fonts.header, color: C.primary, bold: true, align: "center"
  });
  slide.addText(m.label, {
    x, y: 3.0, w: 2.6, h: 0.6,
    fontSize: 16, fontFace: fonts.body, color: C.medium, align: "center"
  });
});`,
    },

    {
        id: 'icon-grid-2x2',
        name: 'Icon Grid (2x2)',
        description:
            '2x2 grid with icons, titles, and descriptions. Use for capabilities, benefits, or categorized items.',
        tags: ['grid', 'icons', '2x2', 'capabilities', 'benefits', 'four', 'quadrant'],
        code: `const slide = pres.addSlide();
slide.addText("Capabilities", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
const items = [
  { icon: "MdAnalytics", title: "Analytics", desc: "Deep data insights" },
  { icon: "MdSecurity", title: "Security", desc: "Zero-trust architecture" },
  { icon: "MdCloud", title: "Cloud", desc: "Multi-cloud support" },
  { icon: "MdSpeed", title: "Performance", desc: "Optimized throughput" },
];
items.forEach((item, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.5 + col * 4.7, y = 1.3 + row * 2.0;
  const iconPng = iconToBase64Png(item.icon, "#" + C.primary, 48);
  slide.addImage({ data: "image/png;base64," + iconPng, x, y: y + 0.1, w: 0.6, h: 0.6 });
  slide.addText(item.title, {
    x: x + 0.8, y, w: 3.5, h: 0.4,
    fontSize: 18, fontFace: fonts.header, color: C.dark, bold: true
  });
  slide.addText(item.desc, {
    x: x + 0.8, y: y + 0.45, w: 3.5, h: 0.4,
    fontSize: 13, fontFace: fonts.body, color: C.medium
  });
});`,
    },

    {
        id: 'timeline-process',
        name: 'Timeline / Process',
        description:
            'Horizontal flow with numbered step circles connected by a line. Use for processes, workflows, or sequential steps.',
        tags: ['timeline', 'process', 'steps', 'flow', 'workflow', 'sequential', 'horizontal'],
        code: `const slide = pres.addSlide();
slide.addText("Our Process", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addShape(shapes.RECTANGLE, { x: 1.0, y: 2.5, w: 8.0, h: 0.04, fill: { color: C.light } });
const steps = ["Discover", "Design", "Develop", "Deploy"];
steps.forEach((step, i) => {
  const x = 1.0 + i * 2.2;
  slide.addShape(shapes.OVAL, { x: x + 0.3, y: 2.1, w: 0.8, h: 0.8, fill: { color: C.primary } });
  slide.addText(String(i + 1), {
    x: x + 0.3, y: 2.1, w: 0.8, h: 0.8,
    fontSize: 20, fontFace: fonts.header, color: C.white, bold: true, align: "center", valign: "middle"
  });
  slide.addText(step, {
    x: x - 0.1, y: 3.2, w: 1.6, h: 0.5,
    fontSize: 14, fontFace: fonts.header, color: C.dark, bold: true, align: "center"
  });
});`,
    },

    {
        id: 'quote',
        name: 'Quote Slide',
        description:
            'Large quote with attribution on a subtle background. Use for impactful quotes, customer testimonials, or key messages.',
        tags: ['quote', 'testimonial', 'citation', 'attribution', 'message', 'blockquote'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.subtle };
slide.addText("\\u201C", {
  x: 1.0, y: 0.8, w: 1, h: 1,
  fontSize: 80, fontFace: fonts.header, color: C.primary
});
slide.addText("Innovation distinguishes between a leader and a follower.", {
  x: 1.5, y: 1.5, w: 7.0, h: 2.0,
  fontSize: 26, fontFace: fonts.body, color: C.dark, italic: true, align: "center"
});
slide.addText("\\u2014 Steve Jobs", {
  x: 1.5, y: 3.5, w: 7.0, h: 0.6,
  fontSize: 16, fontFace: fonts.body, color: C.medium, align: "center"
});`,
    },

    {
        id: 'comparison-versus',
        name: 'Comparison / Versus',
        description:
            'Side-by-side comparison with a vertical divider. Use for before/after, pros/cons, or head-to-head comparisons.',
        tags: ['comparison', 'versus', 'vs', 'before', 'after', 'pros', 'cons', 'side-by-side'],
        code: `const slide = pres.addSlide();
slide.addText("Before vs After", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addShape(shapes.RECTANGLE, { x: 4.95, y: 1.2, w: 0.1, h: 4.0, fill: { color: C.light } });
// Left side
slide.addText("Before", {
  x: 0.5, y: 1.3, w: 4.2, h: 0.6,
  fontSize: 22, fontFace: fonts.header, color: C.danger, bold: true, align: "center"
});
slide.addText("Manual processes\\nSlow turnaround\\nInconsistent quality", {
  x: 0.7, y: 2.2, w: 3.8, h: 2.5,
  fontSize: 16, fontFace: fonts.body, color: C.medium, bullet: { code: "2022" }
});
// Right side
slide.addText("After", {
  x: 5.3, y: 1.3, w: 4.2, h: 0.6,
  fontSize: 22, fontFace: fonts.header, color: C.success, bold: true, align: "center"
});
slide.addText("Automated workflows\\nInstant delivery\\nConsistent output", {
  x: 5.5, y: 2.2, w: 3.8, h: 2.5,
  fontSize: 16, fontFace: fonts.body, color: C.medium, bullet: { code: "2022" }
});`,
    },

    {
        id: 'image-text',
        name: 'Image + Text',
        description:
            'Image placeholder on one side with text content on the other. Use for visual storytelling, product showcases, or photo-driven slides.',
        tags: ['image', 'text', 'photo', 'visual', 'media', 'left-right', 'picture'],
        code: `const slide = pres.addSlide();
// Image placeholder (colored rectangle)
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 0.5, w: 4.2, h: 4.625,
  fill: { color: C.subtle }, rectRadius: 0.15
});
slide.addText("[Image]", {
  x: 0.5, y: 2.2, w: 4.2, h: 1.0,
  fontSize: 16, color: C.light, align: "center"
});
// Text content
slide.addText("Visual Storytelling", {
  x: 5.2, y: 0.8, w: 4.3, h: 0.7,
  fontSize: 26, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addText("Use compelling visuals paired with concise text to communicate your message effectively.", {
  x: 5.2, y: 1.7, w: 4.3, h: 2.5,
  fontSize: 15, fontFace: fonts.body, color: C.medium
});`,
    },

    {
        id: 'table',
        name: 'Table',
        description:
            'Data table with a styled header row. Use for structured data, feature comparisons, pricing tables, or schedules.',
        tags: ['table', 'data', 'grid', 'comparison', 'pricing', 'schedule', 'rows', 'columns'],
        code: `const slide = pres.addSlide();
slide.addText("Comparison Data", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
const tableData = [
  [
    { text: "Feature", options: { bold: true, color: C.white, fill: { color: C.primary } } },
    { text: "Basic", options: { bold: true, color: C.white, fill: { color: C.primary } } },
    { text: "Pro", options: { bold: true, color: C.white, fill: { color: C.primary } } },
  ],
  [{ text: "Storage" }, { text: "10 GB" }, { text: "Unlimited" }],
  [{ text: "Users" }, { text: "5" }, { text: "Unlimited" }],
  [{ text: "Support" }, { text: "Email" }, { text: "24/7 Phone" }],
];
slide.addTable(tableData, {
  x: 0.5, y: 1.3, w: 9.0, h: 3.5,
  fontSize: 14, fontFace: fonts.body, color: C.dark,
  border: { color: C.light, pt: 1 },
  colW: [3, 3, 3], rowH: [0.5, 0.45, 0.45, 0.45],
  align: "center", valign: "middle"
});`,
    },

    {
        id: 'agenda-toc',
        name: 'Agenda / Table of Contents',
        description:
            'Numbered list of sections with colored number badges. Use near the beginning of a deck to outline the structure.',
        tags: ['agenda', 'toc', 'table-of-contents', 'outline', 'structure', 'overview', 'sections'],
        code: `const slide = pres.addSlide();
slide.addText("Agenda", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addShape(shapes.RECTANGLE, { x: 0.5, y: 1.0, w: 1.5, h: 0.05, fill: { color: C.primary } });
const sections = ["Introduction & Context", "Problem Statement", "Our Solution", "Demo & Results", "Next Steps"];
sections.forEach((sec, i) => {
  const y = 1.4 + i * 0.75;
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 0.5, h: 0.5,
    fill: { color: C.primary }, rectRadius: 0.08
  });
  slide.addText(String(i + 1), {
    x: 0.5, y, w: 0.5, h: 0.5,
    fontSize: 16, fontFace: fonts.header, color: C.white, bold: true, align: "center", valign: "middle"
  });
  slide.addText(sec, {
    x: 1.2, y, w: 7.5, h: 0.5,
    fontSize: 18, fontFace: fonts.body, color: C.dark, valign: "middle"
  });
});`,
    },

    {
        id: 'full-color-background',
        name: 'Full-Color Background',
        description:
            'Dark or vibrant background with white text and accent line. Use for key insights, dramatic statements, or transition moments.',
        tags: ['background', 'full-color', 'dark', 'vibrant', 'insight', 'statement', 'dramatic'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.dark };
slide.addText("Key Insight", {
  x: 0.5, y: 0.8, w: 9.0, h: 0.8,
  fontSize: 32, fontFace: fonts.header, color: C.white, bold: true, align: "center"
});
slide.addShape(shapes.RECTANGLE, { x: 4.0, y: 1.8, w: 2.0, h: 0.05, fill: { color: C.primary } });
slide.addText("The most impactful insights are the ones that change how you think about the problem.", {
  x: 1.5, y: 2.2, w: 7.0, h: 2.0,
  fontSize: 18, fontFace: fonts.body, color: "D1D5DB", align: "center"
});`,
    },

    {
        id: 'thank-you-closing',
        name: 'Thank You / Closing',
        description:
            'Clean closing slide with contact info on a colored background. Use as the final slide of any presentation.',
        tags: ['thank-you', 'closing', 'end', 'final', 'contact', 'goodbye', 'wrap-up'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.primary };
slide.addText("Thank You", {
  x: 0.5, y: 1.5, w: 9.0, h: 1.2,
  fontSize: 44, fontFace: fonts.header, color: C.white, bold: true, align: "center"
});
slide.addText("Questions? Let's discuss.", {
  x: 0.5, y: 2.8, w: 9.0, h: 0.7,
  fontSize: 20, fontFace: fonts.body, color: C.white, align: "center"
});
slide.addText("email@example.com", {
  x: 0.5, y: 3.8, w: 9.0, h: 0.5,
  fontSize: 16, fontFace: fonts.body, color: C.white, align: "center"
});`,
    },

    {
        id: 'numbered-list',
        name: 'Numbered List with Descriptions',
        description:
            'Numbered items with title and description pairs. Use for priorities, steps, or ranked items with explanations.',
        tags: ['numbered', 'list', 'priorities', 'ranked', 'ordered', 'descriptions', 'steps'],
        code: `const slide = pres.addSlide();
slide.addText("Top Priorities", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});
const items = [
  { title: "Security First", desc: "Implement zero-trust architecture across all services" },
  { title: "Scale Infrastructure", desc: "Migrate to auto-scaling Kubernetes clusters" },
  { title: "Improve DX", desc: "Reduce build times and streamline deployment" },
];
items.forEach((item, i) => {
  const y = 1.3 + i * 1.3;
  slide.addShape(shapes.OVAL, { x: 0.5, y, w: 0.6, h: 0.6, fill: { color: C.primary } });
  slide.addText(String(i + 1), {
    x: 0.5, y, w: 0.6, h: 0.6,
    fontSize: 18, fontFace: fonts.header, color: C.white, bold: true, align: "center", valign: "middle"
  });
  slide.addText(item.title, {
    x: 1.4, y, w: 8.0, h: 0.35,
    fontSize: 18, fontFace: fonts.header, color: C.dark, bold: true
  });
  slide.addText(item.desc, {
    x: 1.4, y: y + 0.4, w: 8.0, h: 0.35,
    fontSize: 14, fontFace: fonts.body, color: C.medium
  });
});`,
    },

    // ─── New patterns from the agentic AI presentation (17-23) ─────────

    {
        id: 'bio-profile',
        name: 'Bio / Profile',
        description:
            'Speaker or presenter introduction with a photo circle and bio on the left, and three stacked info cards with colored accent bars and icons on the right.',
        tags: ['bio', 'profile', 'speaker', 'presenter', 'about', 'introduction', 'person', 'photo'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.subtle };

// Left panel background
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 0.4, y: 0.4, w: 3.4, h: 4.825,
  fill: { color: C.white }, rectRadius: 0.15, shadow: makeCardShadow()
});

// Photo circle placeholder
slide.addShape(shapes.OVAL, {
  x: 1.3, y: 0.7, w: 1.6, h: 1.6,
  fill: { color: C.light }
});
slide.addText("Photo", {
  x: 1.3, y: 0.7, w: 1.6, h: 1.6,
  fontSize: 12, fontFace: fonts.body, color: C.medium, align: "center", valign: "middle"
});

// Name and title
slide.addText("Jane Smith", {
  x: 0.6, y: 2.5, w: 3.0, h: 0.5,
  fontSize: 22, fontFace: fonts.header, color: C.dark, bold: true, align: "center"
});
slide.addText("VP of Engineering\\nAcme Corp", {
  x: 0.6, y: 3.0, w: 3.0, h: 0.7,
  fontSize: 13, fontFace: fonts.body, color: C.medium, align: "center"
});
slide.addText("15+ years building scalable platforms and leading high-performance teams.", {
  x: 0.6, y: 3.8, w: 3.0, h: 1.0,
  fontSize: 11, fontFace: fonts.body, color: C.medium, align: "center"
});

// Right side: 3 stacked info cards
const infoCards = [
  { icon: "FaBriefcase", title: "Experience", desc: "Led engineering at 3 Fortune 500 companies", color: C.primary },
  { icon: "FaGraduationCap", title: "Education", desc: "M.S. Computer Science, Stanford University", color: C.secondary },
  { icon: "FaTrophy", title: "Achievements", desc: "Scaled systems to 100M+ daily active users", color: C.accent },
];
infoCards.forEach((card, i) => {
  const y = 0.5 + i * 1.65;
  // Card background
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x: 4.2, y, w: 5.3, h: 1.4,
    fill: { color: C.white }, rectRadius: 0.12, shadow: makeCardShadow()
  });
  // Colored accent bar on left of card
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x: 4.2, y, w: 0.12, h: 1.4,
    fill: { color: card.color }, rectRadius: 0.06
  });
  // Icon circle
  slide.addShape(shapes.OVAL, {
    x: 4.55, y: y + 0.3, w: 0.7, h: 0.7,
    fill: { color: card.color }
  });
  const iconPng = iconToBase64Png(card.icon, "#FFFFFF", 32);
  slide.addImage({ data: "image/png;base64," + iconPng, x: 4.7, y: y + 0.45, w: 0.4, h: 0.4 });
  // Title and description
  slide.addText(card.title, {
    x: 5.5, y: y + 0.2, w: 3.7, h: 0.4,
    fontSize: 16, fontFace: fonts.header, color: C.dark, bold: true
  });
  slide.addText(card.desc, {
    x: 5.5, y: y + 0.65, w: 3.7, h: 0.5,
    fontSize: 12, fontFace: fonts.body, color: C.medium
  });
});`,
    },

    {
        id: 'stacked-horizontal-cards',
        name: 'Stacked Horizontal Cards',
        description:
            'Three full-width cards stacked vertically, each with a colored left accent bar, icon circle, title, and description. Great for key points with visual emphasis.',
        tags: ['stacked', 'horizontal', 'cards', 'accent', 'bar', 'icon', 'vertical-stack', 'rows'],
        code: `const slide = pres.addSlide();
slide.addText("Core Principles", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.dark, bold: true
});

const cards = [
  { icon: "FaRocket", title: "Speed", desc: "Deliver results faster with automated pipelines and real-time feedback loops.", color: C.primary },
  { icon: "FaShieldAlt", title: "Security", desc: "Enterprise-grade protection with zero-trust architecture and end-to-end encryption.", color: C.secondary },
  { icon: "FaUsers", title: "Collaboration", desc: "Break down silos with integrated workflows and shared visibility across teams.", color: C.accent },
];
cards.forEach((card, i) => {
  const y = 1.2 + i * 1.45;
  // Card background
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 9.0, h: 1.2,
    fill: { color: C.subtle }, rectRadius: 0.12, shadow: makeCardShadow()
  });
  // Colored left accent bar
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y, w: 0.12, h: 1.2,
    fill: { color: card.color }, rectRadius: 0.06
  });
  // Icon circle
  slide.addShape(shapes.OVAL, {
    x: 0.9, y: y + 0.2, w: 0.75, h: 0.75,
    fill: { color: card.color }
  });
  const iconPng = iconToBase64Png(card.icon, "#FFFFFF", 36);
  slide.addImage({ data: "image/png;base64," + iconPng, x: 1.07, y: y + 0.37, w: 0.42, h: 0.42 });
  // Title and description
  slide.addText(card.title, {
    x: 1.9, y: y + 0.15, w: 7.3, h: 0.4,
    fontSize: 18, fontFace: fonts.header, color: C.dark, bold: true
  });
  slide.addText(card.desc, {
    x: 1.9, y: y + 0.55, w: 7.3, h: 0.5,
    fontSize: 13, fontFace: fonts.body, color: C.medium
  });
});`,
    },

    {
        id: 'nine-cards-grid',
        name: 'Nine Cards Grid (3x3)',
        description:
            '3x3 grid of compact cards, each with a colored top accent bar, icon, title, and short description. Colors cycle through the accent palette. Use for extensive feature lists or capability matrices.',
        tags: ['nine', 'grid', '3x3', 'cards', 'features', 'capabilities', 'matrix', 'compact', 'many'],
        code: `const slide = pres.addSlide();
slide.addText("Platform Capabilities", {
  x: 0.5, y: 0.15, w: 9, h: 0.55,
  fontSize: 24, fontFace: fonts.header, color: C.dark, bold: true
});

const accentColors = [C.primary, C.secondary, C.accent, C.info, C.success, C.warning, C.primaryDark, C.danger, C.primary];
const gridItems = [
  { icon: "MdAnalytics", title: "Analytics", desc: "Real-time dashboards" },
  { icon: "MdSecurity", title: "Security", desc: "Zero-trust access" },
  { icon: "MdCloud", title: "Cloud", desc: "Multi-cloud deploy" },
  { icon: "FaRobot", title: "AI/ML", desc: "Built-in models" },
  { icon: "FaDatabase", title: "Storage", desc: "Scalable data layer" },
  { icon: "FaNetworkWired", title: "Networking", desc: "Global edge CDN" },
  { icon: "FaCogs", title: "Automation", desc: "CI/CD pipelines" },
  { icon: "FaUsers", title: "Teams", desc: "Role-based access" },
  { icon: "FaChartLine", title: "Monitoring", desc: "Full observability" },
];
gridItems.forEach((item, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = 0.5 + col * 3.1;
  const y = 0.85 + row * 1.6;
  const accent = accentColors[i];
  // Card background
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x, y, w: 2.85, h: 1.4,
    fill: { color: C.white }, rectRadius: 0.1, shadow: makeCardShadow(),
    line: { color: C.subtle, width: 0.5 }
  });
  // Top accent bar
  slide.addShape(shapes.RECTANGLE, {
    x: x + 0.15, y, w: 2.55, h: 0.06,
    fill: { color: accent }
  });
  // Icon
  const iconPng = iconToBase64Png(item.icon, "#" + accent, 28);
  slide.addImage({ data: "image/png;base64," + iconPng, x: x + 0.2, y: y + 0.25, w: 0.4, h: 0.4 });
  // Title and description
  slide.addText(item.title, {
    x: x + 0.7, y: y + 0.2, w: 1.9, h: 0.35,
    fontSize: 13, fontFace: fonts.header, color: C.dark, bold: true
  });
  slide.addText(item.desc, {
    x: x + 0.7, y: y + 0.55, w: 1.9, h: 0.6,
    fontSize: 10, fontFace: fonts.body, color: C.medium
  });
});`,
    },

    {
        id: 'big-statement',
        name: 'Big Statement',
        description:
            'Dramatic oversized text as the focal point with a subtitle and supporting bullet card below. Use for surprising reveals, provocative questions, or emphasis slides.',
        tags: ['big', 'statement', 'dramatic', 'emphasis', 'reveal', 'surprise', 'bold', 'large-text'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.subtle };

// Big dramatic text
slide.addText("No.", {
  x: 0.5, y: 0.4, w: 9.0, h: 1.8,
  fontSize: 96, fontFace: fonts.header, color: C.primary, bold: true, align: "center", valign: "middle"
});

// Subtitle
slide.addText("Traditional approaches no longer work.", {
  x: 1.0, y: 2.3, w: 8.0, h: 0.6,
  fontSize: 20, fontFace: fonts.body, color: C.dark, align: "center"
});

// Supporting bullet card
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 1.0, y: 3.2, w: 8.0, h: 2.0,
  fill: { color: C.white }, rectRadius: 0.12, shadow: makeCardShadow()
});
const points = ["Manual review cannot scale to modern volumes", "Human error rates increase with complexity", "Competitors have already automated"];
points.forEach((pt, i) => {
  slide.addText(pt, {
    x: 1.4, y: 3.4 + i * 0.55, w: 7.2, h: 0.45,
    fontSize: 14, fontFace: fonts.body, color: C.medium, bullet: { code: "2022" }
  });
});`,
    },

    {
        id: 'hero-plus-details',
        name: 'Hero + Details',
        description:
            'Full-width hero info card on top with a large statement, then three smaller detail cards below. Use for introducing a concept with supporting evidence.',
        tags: ['hero', 'details', 'overview', 'summary', 'highlight', 'featured', 'breakdown'],
        code: `const slide = pres.addSlide();

// Hero card (full-width top)
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 0.4, w: 9.0, h: 2.0,
  fill: { color: C.primary }, rectRadius: 0.15, shadow: makeCardShadow()
});
slide.addText("The Future of Automation", {
  x: 0.8, y: 0.6, w: 8.4, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.white, bold: true
});
slide.addText("AI-powered workflows reduce manual effort by 80% while improving accuracy and consistency across the entire pipeline.", {
  x: 0.8, y: 1.3, w: 8.4, h: 0.9,
  fontSize: 14, fontFace: fonts.body, color: "E0E7FF"
});

// Three detail cards below
const details = [
  { icon: "FaChartLine", title: "80% Faster", desc: "Processing time reduced dramatically" },
  { icon: "FaBullseye", title: "99.5% Accuracy", desc: "Near-perfect automated decisions" },
  { icon: "FaDollarSign", title: "3x ROI", desc: "Returns realized within 6 months" },
];
details.forEach((d, i) => {
  const x = 0.5 + i * 3.1;
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x, y: 2.8, w: 2.85, h: 2.4,
    fill: { color: C.white }, rectRadius: 0.12, shadow: makeCardShadow(),
    line: { color: C.subtle, width: 0.5 }
  });
  const iconPng = iconToBase64Png(d.icon, "#" + C.primary, 40);
  slide.addImage({ data: "image/png;base64," + iconPng, x: x + 0.95, y: 3.0, w: 0.7, h: 0.7 });
  slide.addText(d.title, {
    x: x + 0.15, y: 3.85, w: 2.55, h: 0.4,
    fontSize: 16, fontFace: fonts.header, color: C.dark, bold: true, align: "center"
  });
  slide.addText(d.desc, {
    x: x + 0.15, y: 4.25, w: 2.55, h: 0.7,
    fontSize: 12, fontFace: fonts.body, color: C.medium, align: "center"
  });
});`,
    },

    {
        id: 'column-plus-callout',
        name: 'Column + Callout',
        description:
            'Two side-by-side content cards plus a separate bottom callout bar with accent color and italic text. Use when you need two content areas with an important takeaway.',
        tags: ['column', 'callout', 'banner', 'two-column', 'takeaway', 'highlight', 'note', 'cta'],
        code: `const slide = pres.addSlide();
slide.addText("Strategic Approach", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 26, fontFace: fonts.header, color: C.dark, bold: true
});

// Left card
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.1, w: 4.2, h: 2.8,
  fill: { color: C.white }, rectRadius: 0.12, shadow: makeCardShadow(),
  line: { color: C.subtle, width: 0.5 }
});
const icon1 = iconToBase64Png("FaLightbulb", "#" + C.primary, 36);
slide.addImage({ data: "image/png;base64," + icon1, x: 0.8, y: 1.3, w: 0.5, h: 0.5 });
slide.addText("Short-Term Wins", {
  x: 1.5, y: 1.3, w: 2.9, h: 0.45,
  fontSize: 17, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addText("Quick automation of repetitive tasks\\nStandardize existing workflows\\nImmediate cost savings", {
  x: 0.8, y: 2.0, w: 3.6, h: 1.7,
  fontSize: 13, fontFace: fonts.body, color: C.medium, bullet: { code: "2022" }
});

// Right card
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 5.3, y: 1.1, w: 4.2, h: 2.8,
  fill: { color: C.white }, rectRadius: 0.12, shadow: makeCardShadow(),
  line: { color: C.subtle, width: 0.5 }
});
const icon2 = iconToBase64Png("FaRocket", "#" + C.secondary, 36);
slide.addImage({ data: "image/png;base64," + icon2, x: 5.6, y: 1.3, w: 0.5, h: 0.5 });
slide.addText("Long-Term Vision", {
  x: 6.3, y: 1.3, w: 2.9, h: 0.45,
  fontSize: 17, fontFace: fonts.header, color: C.dark, bold: true
});
slide.addText("Full AI-driven decision making\\nPredictive analytics platform\\nAutonomous operations", {
  x: 5.6, y: 2.0, w: 3.6, h: 1.7,
  fontSize: 13, fontFace: fonts.body, color: C.medium, bullet: { code: "2022" }
});

// Bottom callout bar
slide.addShape(shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.2, w: 9.0, h: 1.0,
  fill: { color: C.primary }, rectRadius: 0.12
});
slide.addText("Key Takeaway: Start small, prove value quickly, then scale with confidence.", {
  x: 0.8, y: 4.2, w: 8.4, h: 1.0,
  fontSize: 15, fontFace: fonts.body, color: C.white, italic: true, valign: "middle"
});`,
    },

    {
        id: 'vertical-timeline',
        name: 'Vertical Timeline',
        description:
            'Vertical line with colored circle nodes at intervals, each with a card containing date, title, and description. Use for chronological events, roadmaps, or milestones.',
        tags: ['vertical', 'timeline', 'chronological', 'roadmap', 'milestones', 'events', 'history', 'dates'],
        code: `const slide = pres.addSlide();
slide.addText("Roadmap", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 26, fontFace: fonts.header, color: C.dark, bold: true
});

const milestones = [
  { date: "Q1 2025", title: "Foundation", desc: "Core platform launch and initial integrations", color: C.primary },
  { date: "Q2 2025", title: "Expansion", desc: "AI features and partner ecosystem rollout", color: C.secondary },
  { date: "Q3 2025", title: "Scale", desc: "Enterprise tier, global regions, advanced analytics", color: C.accent },
  { date: "Q4 2025", title: "Maturity", desc: "Self-service marketplace and autonomous operations", color: C.success },
];

// Vertical line
slide.addShape(shapes.RECTANGLE, {
  x: 2.45, y: 1.0, w: 0.04, h: 4.2,
  fill: { color: C.light }
});

milestones.forEach((m, i) => {
  const y = 1.05 + i * 1.1;
  // Circle node on the line
  slide.addShape(shapes.OVAL, {
    x: 2.2, y: y + 0.1, w: 0.55, h: 0.55,
    fill: { color: m.color }
  });
  // Date label to the left
  slide.addText(m.date, {
    x: 0.3, y: y + 0.1, w: 1.7, h: 0.55,
    fontSize: 12, fontFace: fonts.header, color: m.color, bold: true, align: "right", valign: "middle"
  });
  // Card to the right
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x: 3.1, y, w: 6.4, h: 0.9,
    fill: { color: C.subtle }, rectRadius: 0.1, shadow: makeCardShadow()
  });
  slide.addText(m.title, {
    x: 3.3, y, w: 3.0, h: 0.45,
    fontSize: 15, fontFace: fonts.header, color: C.dark, bold: true
  });
  slide.addText(m.desc, {
    x: 3.3, y: y + 0.42, w: 5.9, h: 0.4,
    fontSize: 11, fontFace: fonts.body, color: C.medium
  });
});`,
    },

    // ─── Dark-theme variants (24-25) ───────────────────────────────────

    {
        id: 'dark-title-slide',
        name: 'Dark Title Slide',
        description:
            'Dark background with decorative accent bars, large white title, subtitle in accent color, and bottom accent bar. Use as an opening slide for dark-themed decks.',
        tags: ['dark', 'title', 'opening', 'intro', 'cover', 'hero', 'dark-theme', 'night'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.dark || "0F1729" };

// Decorative accent bars at top
slide.addShape(shapes.RECTANGLE, { x: 0, y: 0, w: 3.5, h: 0.08, fill: { color: C.primary } });
slide.addShape(shapes.RECTANGLE, { x: 3.7, y: 0, w: 2.0, h: 0.08, fill: { color: C.secondary } });
slide.addShape(shapes.RECTANGLE, { x: 5.9, y: 0, w: 1.2, h: 0.08, fill: { color: C.accent } });

// Title
slide.addText("Presentation Title", {
  x: 0.8, y: 1.5, w: 8.4, h: 1.4,
  fontSize: 42, fontFace: fonts.header, color: C.white, bold: true, align: "center"
});

// Subtitle in accent color
slide.addText("A subtitle with context and purpose", {
  x: 1.5, y: 3.0, w: 7.0, h: 0.7,
  fontSize: 18, fontFace: fonts.body, color: C.primary, align: "center"
});

// Presenter info
slide.addText("Presented by Jane Smith  |  March 2025", {
  x: 1.5, y: 3.9, w: 7.0, h: 0.5,
  fontSize: 13, fontFace: fonts.body, color: C.light, align: "center"
});

// Bottom accent bar
slide.addShape(shapes.RECTANGLE, { x: 0, y: 5.4, w: 10.0, h: 0.08, fill: { color: C.primary } });`,
    },

    {
        id: 'dark-three-cards',
        name: 'Dark Three Cards',
        description:
            'Three feature cards on a dark background. Cards use a darker fill with colored top accent bars cycling through accents, white text, and icons in dark circles. Use for feature highlights in dark-themed decks.',
        tags: ['dark', 'three', 'cards', 'features', 'dark-theme', 'night', 'icons', 'pillars'],
        code: `const slide = pres.addSlide();
slide.background = { color: C.dark || "0F1729" };

slide.addText("Core Features", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 28, fontFace: fonts.header, color: C.white, bold: true
});
slide.addShape(shapes.RECTANGLE, { x: 0.5, y: 1.0, w: 1.5, h: 0.05, fill: { color: C.primary } });

const cardBg = "1E2F50";
const features = [
  { icon: "FaRocket", title: "Performance", desc: "Optimized for speed with sub-50ms response times across all regions.", accent: C.primary },
  { icon: "MdSecurity", title: "Security", desc: "End-to-end encryption with zero-trust architecture and SOC2 compliance.", accent: C.secondary },
  { icon: "FaCogs", title: "Automation", desc: "Intelligent workflows that learn and adapt to your team's patterns.", accent: C.accent },
];

features.forEach((f, i) => {
  const x = 0.5 + i * 3.1;
  // Card background
  slide.addShape(shapes.ROUNDED_RECTANGLE, {
    x, y: 1.3, w: 2.85, h: 3.8,
    fill: { color: cardBg }, rectRadius: 0.15, shadow: makeCardShadow()
  });
  // Top accent bar
  slide.addShape(shapes.RECTANGLE, {
    x: x + 0.2, y: 1.3, w: 2.45, h: 0.07,
    fill: { color: f.accent }
  });
  // Icon in dark circle
  slide.addShape(shapes.OVAL, {
    x: x + 0.85, y: 1.65, w: 1.1, h: 1.1,
    fill: { color: C.dark || "0F1729" }
  });
  const iconPng = iconToBase64Png(f.icon, "#" + f.accent, 48);
  slide.addImage({ data: "image/png;base64," + iconPng, x: x + 1.05, y: 1.85, w: 0.7, h: 0.7 });
  // Title
  slide.addText(f.title, {
    x: x + 0.15, y: 3.0, w: 2.55, h: 0.5,
    fontSize: 18, fontFace: fonts.header, color: C.white, bold: true, align: "center"
  });
  // Description
  slide.addText(f.desc, {
    x: x + 0.2, y: 3.5, w: 2.45, h: 1.3,
    fontSize: 12, fontFace: fonts.body, color: C.light, align: "center"
  });
});`,
    },
];

/**
 * Search patterns by name, tags, and description.
 * Returns all patterns whose name, tags, or description match any word in the query (case-insensitive).
 */
export function searchPatterns(query: string): Pattern[] {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);
    if (terms.length === 0) return [...PATTERNS];

    return PATTERNS.filter((p) => {
        const haystack = [p.name, p.description, ...p.tags].join(' ').toLowerCase();
        return terms.some((term) => haystack.includes(term));
    });
}
