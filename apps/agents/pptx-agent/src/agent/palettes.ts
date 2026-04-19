export interface Palette {
    id: string;
    name: string;
    description: string;
    colors: Record<string, string>;
}

export const PALETTES: Palette[] = [
    {
        id: 'ocean-blue',
        name: 'Ocean Blue',
        description:
            'Professional blue palette ideal for corporate, technology, and business presentations. Clean and trustworthy.',
        colors: {
            primary: '2563EB',
            primaryDark: '1E40AF',
            secondary: '7C3AED',
            accent: '059669',
            dark: '111827',
            medium: '4B5563',
            light: '9CA3AF',
            subtle: 'F3F4F6',
            white: 'FFFFFF',
            black: '000000',
            success: '10B981',
            warning: 'F59E0B',
            danger: 'EF4444',
            info: '3B82F6',
        },
    },
    {
        id: 'dark-ocean',
        name: 'Dark Ocean',
        description:
            'Dark navy background with cyan, green, and orange accents. Great for tech demos, AI/ML topics, and futuristic themes.',
        colors: {
            primary: '00D4FF',
            primaryDark: '0099CC',
            secondary: '7C3AED',
            accent: '10B981',
            dark: '0F1729',
            medium: '8899AA',
            light: '556677',
            subtle: '1A2744',
            white: 'FFFFFF',
            black: '000000',
            success: '10B981',
            warning: 'F59E0B',
            danger: 'EF4444',
            info: '38BDF8',
        },
    },
    {
        id: 'warm-corporate',
        name: 'Warm Corporate',
        description:
            'Warm tones with burgundy and amber. Conveys authority and warmth, suited for executive briefings, finance, and HR presentations.',
        colors: {
            primary: '991B1B',
            primaryDark: '7F1D1D',
            secondary: 'B45309',
            accent: 'D97706',
            dark: '1C1917',
            medium: '57534E',
            light: 'A8A29E',
            subtle: 'F5F5F4',
            white: 'FFFFFF',
            black: '000000',
            success: '16A34A',
            warning: 'EA580C',
            danger: 'DC2626',
            info: '2563EB',
        },
    },
    {
        id: 'forest-green',
        name: 'Forest Green',
        description:
            'Nature-inspired greens and earth tones. Perfect for sustainability, environmental, health, and wellness presentations.',
        colors: {
            primary: '15803D',
            primaryDark: '14532D',
            secondary: '4D7C0F',
            accent: '0D9488',
            dark: '14120E',
            medium: '525244',
            light: '9CA38C',
            subtle: 'F0F4ED',
            white: 'FFFFFF',
            black: '000000',
            success: '22C55E',
            warning: 'CA8A04',
            danger: 'DC2626',
            info: '0EA5E9',
        },
    },
    {
        id: 'sunset-gradient',
        name: 'Sunset Gradient',
        description:
            'Warm oranges, coral, and deep purple. Energetic and creative, great for marketing, brand launches, and design presentations.',
        colors: {
            primary: 'EA580C',
            primaryDark: 'C2410C',
            secondary: '7E22CE',
            accent: 'E11D48',
            dark: '1E1127',
            medium: '6B5B7B',
            light: 'A39BB0',
            subtle: 'FFF7ED',
            white: 'FFFFFF',
            black: '000000',
            success: '16A34A',
            warning: 'F59E0B',
            danger: 'BE123C',
            info: '8B5CF6',
        },
    },
    {
        id: 'minimal-gray',
        name: 'Minimal Gray',
        description:
            'Clean grayscale with a single teal accent. Understated and elegant, ideal for minimalist decks, photography showcases, and editorial presentations.',
        colors: {
            primary: '0F766E',
            primaryDark: '115E59',
            secondary: '374151',
            accent: '0F766E',
            dark: '111827',
            medium: '6B7280',
            light: 'D1D5DB',
            subtle: 'F9FAFB',
            white: 'FFFFFF',
            black: '000000',
            success: '059669',
            warning: 'D97706',
            danger: 'DC2626',
            info: '0284C7',
        },
    },
    {
        id: 'tech-purple',
        name: 'Tech Purple',
        description:
            'Modern purple and violet with electric accents. Bold and innovative, suited for startups, product launches, and developer-facing content.',
        colors: {
            primary: '7C3AED',
            primaryDark: '5B21B6',
            secondary: 'EC4899',
            accent: '06B6D4',
            dark: '0F0720',
            medium: '6B6185',
            light: 'A5A0B5',
            subtle: 'FAF5FF',
            white: 'FFFFFF',
            black: '000000',
            success: '10B981',
            warning: 'F59E0B',
            danger: 'EF4444',
            info: '8B5CF6',
        },
    },
    {
        id: 'earth-tones',
        name: 'Earth Tones',
        description:
            'Muted browns, olive, and terracotta. Grounded and authentic, ideal for non-profits, education, architecture, and craft-related presentations.',
        colors: {
            primary: '92400E',
            primaryDark: '78350F',
            secondary: '65712F',
            accent: 'B45309',
            dark: '1C1712',
            medium: '6B5E50',
            light: 'A89F91',
            subtle: 'FAF8F5',
            white: 'FFFFFF',
            black: '000000',
            success: '4D7C0F',
            warning: 'CA8A04',
            danger: 'C2410C',
            info: '0369A1',
        },
    },
];

/**
 * Search palettes by name, description, or color mood keywords (case-insensitive).
 * Returns all palettes whose name or description match any word in the query.
 */
export function searchPalettes(query: string): Palette[] {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);
    if (terms.length === 0) return [...PALETTES];

    return PALETTES.filter((p) => {
        const haystack = [p.id, p.name, p.description].join(' ').toLowerCase();
        return terms.some((term) => haystack.includes(term));
    });
}
