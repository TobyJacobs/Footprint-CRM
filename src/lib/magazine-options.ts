// Premium positions an advert can have (the database only accepts these).
// Kept apart from lib/magazines (server only) so the advert form can use it.
export const premiumPositions = ["Front cover", "Back cover", "Inside front cover", "Inside back cover", "First page", "Centre spread", "Facing editorial"] as const;

// A flatplan page's area in mm (the Full Page advert size).
export const PAGE_W = 130;
export const PAGE_H = 190;
