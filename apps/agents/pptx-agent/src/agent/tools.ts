export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export const toolDefinitions: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'initialize_presentation',
            description: 'Create a new PptxGenJS presentation instance with a design system (colors, fonts). Call this first before adding slides. Returns the active color palette and font config.',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'The presentation title',
                    },
                    theme: {
                        type: 'object',
                        description: 'Optional theme overrides',
                        properties: {
                            colors: {
                                type: 'object',
                                description: 'Color palette overrides. Keys: primary, primaryDark, secondary, accent, dark, medium, light, subtle, white, black, success, warning, danger, info. Values: hex without # (e.g. "2563EB")',
                                additionalProperties: { type: 'string' },
                            },
                            fonts: {
                                type: 'object',
                                description: 'Font overrides',
                                properties: {
                                    header: { type: 'string' },
                                    body: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                required: ['title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_slides',
            description: `Execute JavaScript code in a sandboxed environment to add slides to the presentation.

Available globals in the sandbox:
- pres: PptxGenJS instance (call pres.addSlide() to create slides)
- C: Color palette object (e.g. C.primary, C.dark, C.white)
- fonts: { header, body } font names
- makeCardShadow(): Returns a shadow config object for card-like elements
- addFooter(slide, text): Add a footer to a slide
- iconToBase64Png(iconName, color, size?): Convert react-icons to base64 PNG. Use icon names like "FaRocket", "MdSecurity", "BiChart". Returns base64 string for use with slide.addImage({ data: "image/png;base64," + result, ... })
- shapes: PptxGenJS shape type constants (e.g. shapes.ROUNDED_RECTANGLE)
- console: { log, warn, error } for debugging

IMPORTANT: iconToBase64Png is synchronous in this sandbox. Call it inline.
IMPORTANT: All dimensions are in inches. Slide size is 10" x 5.625".`,
            parameters: {
                type: 'object',
                properties: {
                    code: {
                        type: 'string',
                        description: 'JavaScript code to execute. Must use pres.addSlide() to create slides.',
                    },
                    description: {
                        type: 'string',
                        description: 'Human-readable description of what this code does (for logging)',
                    },
                },
                required: ['code', 'description'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'preview_slides',
            description: 'Render the current presentation to JPEG images for visual QA. Uses LibreOffice to convert PPTX to PDF, then pdftoppm for JPEG extraction. Returns base64-encoded images.',
            parameters: {
                type: 'object',
                properties: {
                    slide_numbers: {
                        type: 'array',
                        items: { type: 'number' },
                        description: 'Optional array of 1-based slide numbers to preview. Defaults to all slides.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_pptxgenjs_docs',
            description: 'Look up PptxGenJS API documentation by topic. Returns relevant type definitions and API details. Use this when you need to look up specific properties, options, or methods.',
            parameters: {
                type: 'object',
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Topic to search for (e.g. "table", "chart", "image", "shadow", "text options", "shape options")',
                    },
                },
                required: ['topic'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'finalize_presentation',
            description: 'Save the completed presentation as a .pptx file.',
            parameters: {
                type: 'object',
                properties: {
                    filename: {
                        type: 'string',
                        description: 'Output filename (e.g. "ai-security-deck.pptx")',
                    },
                },
                required: ['filename'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browse_layout_patterns',
            description: `Search the library of 25 slide layout patterns with full code examples. Use this to find patterns by keyword (e.g. "cards", "timeline", "dark theme", "grid", "bio", "quote") or to get the code for a specific pattern by ID. Each result includes a complete runnable code example using the sandbox globals.`,
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query — keyword (e.g. "three cards", "dark", "timeline") or pattern ID (e.g. "stacked-horizontal-cards")',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'browse_color_palettes',
            description: `Search the library of 8 curated color palettes. Each palette has 14 named colors (primary, secondary, accent, dark, light, etc.) ready to use with initialize_presentation. Search by mood or use-case (e.g. "dark", "corporate", "warm", "minimal").`,
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query — keyword (e.g. "dark", "corporate", "green", "purple") or palette ID (e.g. "dark-ocean")',
                    },
                },
                required: ['query'],
            },
        },
    },
];
