// Word lists for word search themes (owner, 9 November 2026): type a theme
// and FootprintOS suggests words for it, which staff can trim or add to.
// Ready-made lists written for a family magazine (British spellings; words
// longer than the grid aren't suggested for it) — free, with no outside
// service (a free word service was tried and its suggestions weren't fit to
// print). Add a theme by adding an entry here.

export type ThemeList = { label: string; keywords: string[]; words: string[] };

export const themeLists: ThemeList[] = [
  // ─── Seasons and dates ───
  { label: "Christmas", keywords: ["christmas", "xmas", "festive", "noel", "yule"], words: ["Tinsel", "Reindeer", "Stocking", "Mistletoe", "Holly", "Ivy", "Carols", "Presents", "Turkey", "Crackers", "Snowman", "Angel", "Star", "Bauble", "Mince pies", "Santa", "Sleigh", "Nativity", "Wreath", "Pudding"] },
  { label: "New Year", keywords: ["new year", "hogmanay", "resolution"], words: ["Fireworks", "Midnight", "Countdown", "Party", "Toast", "Resolution", "Calendar", "Celebrate", "Cheers", "Auld Lang", "Fresh start", "Goals", "January", "Confetti", "Balloons"] },
  { label: "Valentine's Day", keywords: ["valentine", "love", "romance"], words: ["Roses", "Hearts", "Cupid", "Chocolate", "Romance", "Card", "Kiss", "Darling", "Sweetheart", "Flowers", "Dinner", "Candles", "Poem", "Admirer", "February", "Arrow"] },
  { label: "Pancake Day", keywords: ["pancake", "shrove"], words: ["Batter", "Flour", "Eggs", "Milk", "Lemon", "Sugar", "Frying pan", "Flip", "Toss", "Syrup", "Whisk", "Crepe", "Shrove", "Tuesday", "Race", "Golden"] },
  { label: "Easter", keywords: ["easter"], words: ["Bunny", "Chicks", "Eggs", "Chocolate", "Hot cross", "Daffodil", "Basket", "Bonnet", "Lamb", "Spring", "Egg hunt", "Simnel", "Blossom", "Duckling", "Tulip", "Sunday"] },
  { label: "Mother's Day", keywords: ["mother", "mothering", "mum"], words: ["Flowers", "Breakfast", "Card", "Chocolates", "Hugs", "Mum", "Thank you", "Lunch", "Daffodils", "Love", "Family", "Gifts", "Spa day", "Kind", "Care", "Treat"] },
  { label: "Father's Day", keywords: ["father", "dad"], words: ["Barbecue", "Socks", "Tie", "Card", "Golf", "Football", "Tools", "Dad jokes", "Gadget", "Garden", "Fishing", "Lunch", "Family", "Hero", "Pint", "Thank you"] },
  { label: "Spring", keywords: ["spring"], words: ["Blossom", "Daffodil", "Tulip", "Lambs", "Bluebell", "Nest", "Showers", "Primrose", "Buds", "Seedling", "Cuckoo", "Crocus", "Easter", "Fresh", "Green", "Sunshine"] },
  { label: "Summer", keywords: ["summer"], words: ["Sunshine", "Holiday", "Beach", "Ice cream", "Picnic", "Barbecue", "Sandals", "Sun cream", "Paddling", "Camping", "Festival", "Lemonade", "Deckchair", "Strawberry", "Heatwave", "Sunhat"] },
  { label: "Autumn", keywords: ["autumn", "fall", "harvest"], words: ["Leaves", "Conkers", "Acorns", "Pumpkin", "Harvest", "Apples", "Chestnut", "Mushroom", "Golden", "Crunchy", "Squirrel", "Hedgehog", "Misty", "Blackberry", "Bonfire", "Scarf"] },
  { label: "Winter", keywords: ["winter", "snow", "frost", "cold"], words: ["Snowflake", "Frost", "Icicle", "Scarf", "Mittens", "Sledge", "Snowman", "Fireside", "Blanket", "Cocoa", "Robin", "Woolly hat", "Chilly", "Boots", "Snowball", "Hot water"] },
  { label: "Halloween", keywords: ["halloween", "spooky", "witch"], words: ["Pumpkin", "Witch", "Ghost", "Bats", "Spider", "Cauldron", "Broomstick", "Costume", "Lantern", "Spooky", "Skeleton", "Treats", "Haunted", "Black cat", "Moonlight", "Potion"] },
  { label: "Bonfire Night", keywords: ["bonfire", "guy fawkes", "fireworks", "november 5", "5th november"], words: ["Fireworks", "Sparklers", "Rockets", "Bonfire", "Guy Fawkes", "Gunpowder", "November", "Toffee", "Catherine", "Bang", "Display", "Remember", "Treacle", "Wellies", "Gloves", "Flames"] },
  { label: "Remembrance", keywords: ["remembrance", "armistice", "poppy"], words: ["Poppy", "Wreath", "Silence", "Memorial", "Veterans", "Cenotaph", "Armistice", "Remember", "Bugle", "Service", "Honour", "Peace", "Medals", "November", "Parade", "Courage"] },
  // ─── Nature ───
  { label: "Garden birds", keywords: ["bird", "birds", "birdwatch"], words: ["Robin", "Blue tit", "Sparrow", "Wren", "Starling", "Magpie", "Jay", "Blackbird", "Goldfinch", "Thrush", "Chaffinch", "Great tit", "Pigeon", "Woodpecker", "Nuthatch", "Greenfinch"] },
  { label: "Flowers", keywords: ["flower", "flowers", "blooms"], words: ["Rose", "Tulip", "Daisy", "Lily", "Daffodil", "Poppy", "Sunflower", "Lavender", "Bluebell", "Orchid", "Pansy", "Peony", "Snowdrop", "Foxglove", "Marigold", "Dahlia"] },
  { label: "Gardening", keywords: ["garden", "gardening", "allotment"], words: ["Trowel", "Spade", "Compost", "Seedlings", "Watering", "Greenhouse", "Pruning", "Weeding", "Hedge", "Lawn", "Hosepipe", "Rake", "Shed", "Bulbs", "Planter", "Secateurs"] },
  { label: "Trees", keywords: ["tree", "trees", "woodland", "forest"], words: ["Oak", "Ash", "Beech", "Birch", "Willow", "Holly", "Yew", "Elm", "Sycamore", "Chestnut", "Maple", "Hazel", "Rowan", "Pine", "Cherry", "Hawthorn"] },
  { label: "British wildlife", keywords: ["wildlife", "animal", "animals", "countryside"], words: ["Badger", "Fox", "Hedgehog", "Squirrel", "Rabbit", "Deer", "Otter", "Hare", "Mole", "Stoat", "Owl", "Kingfisher", "Frog", "Toad", "Dormouse", "Bat"] },
  { label: "Minibeasts", keywords: ["insect", "insects", "bugs", "minibeast", "butterfly"], words: ["Ladybird", "Butterfly", "Bumblebee", "Beetle", "Spider", "Ant", "Snail", "Greenfly", "Dragonfly", "Moth", "Worm", "Centipede", "Woodlouse", "Earwig", "Wasp", "Slug"] },
  { label: "Weather", keywords: ["weather", "climate"], words: ["Sunshine", "Rain", "Cloud", "Thunder", "Lightning", "Fog", "Drizzle", "Rainbow", "Breeze", "Storm", "Hail", "Frost", "Snow", "Gale", "Mist", "Forecast"] },
  { label: "Seaside", keywords: ["seaside", "beach", "coast", "sea", "ocean"], words: ["Sandcastle", "Bucket", "Spade", "Waves", "Pier", "Seagull", "Rock pool", "Shells", "Crab", "Lighthouse", "Deckchair", "Ice cream", "Promenade", "Pebbles", "Harbour", "Surf"] },
  { label: "Sea life", keywords: ["fish", "marine", "sea life", "underwater"], words: ["Dolphin", "Whale", "Seal", "Octopus", "Jellyfish", "Starfish", "Seahorse", "Lobster", "Shark", "Turtle", "Mackerel", "Coral", "Squid", "Plaice", "Puffin", "Oyster"] },
  { label: "Farm", keywords: ["farm", "farming", "farmyard"], words: ["Tractor", "Barn", "Cows", "Sheep", "Pigs", "Hens", "Horse", "Goat", "Haystack", "Combine", "Field", "Farmer", "Ducks", "Orchard", "Milking", "Scarecrow"] },
  { label: "Pets", keywords: ["pet", "pets"], words: ["Puppy", "Kitten", "Hamster", "Rabbit", "Goldfish", "Budgie", "Tortoise", "Guinea pig", "Lead", "Collar", "Basket", "Vet", "Walkies", "Treats", "Parrot", "Ferret"] },
  { label: "Dogs", keywords: ["dog", "dogs", "puppy"], words: ["Labrador", "Spaniel", "Beagle", "Terrier", "Poodle", "Collie", "Dachshund", "Boxer", "Whippet", "Greyhound", "Pug", "Husky", "Corgi", "Dalmatian", "Lurcher", "Bulldog"] },
  // ─── Food and home ───
  { label: "Baking", keywords: ["baking", "bake", "cake", "cakes"], words: ["Flour", "Butter", "Sugar", "Eggs", "Oven", "Whisk", "Sponge", "Scones", "Icing", "Muffin", "Biscuits", "Pastry", "Rolling pin", "Cupcake", "Brownie", "Crumble"] },
  { label: "Fruit", keywords: ["fruit", "fruits"], words: ["Apple", "Banana", "Cherry", "Grape", "Lemon", "Mango", "Orange", "Peach", "Pear", "Plum", "Kiwi", "Melon", "Raspberry", "Strawberry", "Apricot", "Pineapple"] },
  { label: "Vegetables", keywords: ["vegetable", "vegetables", "veg"], words: ["Carrot", "Potato", "Parsnip", "Cabbage", "Broccoli", "Sprouts", "Onion", "Leek", "Peas", "Beans", "Turnip", "Swede", "Courgette", "Lettuce", "Spinach", "Celery"] },
  { label: "Afternoon tea", keywords: ["afternoon tea", "tea party", "cream tea"], words: ["Scones", "Jam", "Clotted", "Teapot", "Sandwiches", "Cucumber", "Cupcakes", "Saucer", "Teacup", "Earl Grey", "Doily", "Eclair", "Macaron", "Lemonade", "Biscuit", "Sugar lumps"] },
  { label: "Herbs and spices", keywords: ["herb", "herbs", "spice", "spices"], words: ["Basil", "Mint", "Parsley", "Thyme", "Rosemary", "Sage", "Chives", "Oregano", "Coriander", "Ginger", "Nutmeg", "Cinnamon", "Paprika", "Cumin", "Pepper", "Saffron"] },
  { label: "In the kitchen", keywords: ["kitchen", "cooking", "cook"], words: ["Kettle", "Toaster", "Saucepan", "Fridge", "Spatula", "Ladle", "Colander", "Grater", "Oven", "Microwave", "Teaspoon", "Chopping", "Apron", "Recipe", "Blender", "Larder"] },
  // ─── Sport and hobbies ───
  { label: "Football", keywords: ["football", "soccer"], words: ["Goal", "Penalty", "Referee", "Striker", "Keeper", "Corner", "Header", "Offside", "Pitch", "League", "Captain", "Tackle", "Kick off", "Whistle", "Trophy", "Stadium"] },
  { label: "Cricket", keywords: ["cricket"], words: ["Wicket", "Bowler", "Batsman", "Stumps", "Umpire", "Innings", "Boundary", "Century", "Pavilion", "Crease", "Bails", "Fielder", "Over", "Sixes", "Teatime", "Ashes"] },
  { label: "Tennis", keywords: ["tennis", "wimbledon"], words: ["Racket", "Serve", "Volley", "Net", "Deuce", "Advantage", "Ace", "Umpire", "Rally", "Baseline", "Lob", "Smash", "Grass", "Champion", "Strawberry", "Ballgirl"] },
  { label: "Sports", keywords: ["sport", "sports", "olympic", "olympics"], words: ["Rugby", "Tennis", "Cricket", "Football", "Golf", "Hockey", "Netball", "Rowing", "Cycling", "Swimming", "Athletics", "Boxing", "Darts", "Snooker", "Bowls", "Archery"] },
  { label: "Hobbies", keywords: ["hobby", "hobbies", "crafts", "craft"], words: ["Knitting", "Painting", "Reading", "Fishing", "Baking", "Gardening", "Singing", "Dancing", "Crochet", "Pottery", "Jigsaws", "Birding", "Sewing", "Walking", "Photos", "Chess"] },
  { label: "Music", keywords: ["music", "instrument", "instruments", "band", "orchestra"], words: ["Piano", "Guitar", "Violin", "Drums", "Trumpet", "Flute", "Cello", "Harp", "Clarinet", "Ukulele", "Choir", "Melody", "Rhythm", "Concert", "Chorus", "Banjo"] },
  { label: "Board games", keywords: ["game", "games", "board game"], words: ["Chess", "Draughts", "Scrabble", "Monopoly", "Cluedo", "Dominoes", "Ludo", "Snakes", "Ladders", "Dice", "Cards", "Bingo", "Jigsaw", "Backgammon", "Solitaire", "Patience"] },
  // ─── Places and getting about ───
  { label: "Hampshire places", keywords: ["hampshire", "local", "hants", "our area"], words: ["Fareham", "Gosport", "Portchester", "Titchfield", "Warsash", "Hamble", "Whiteley", "Locks Heath", "Hedge End", "West End", "Fair Oak", "Wickham", "Botley", "Stubbington", "Lee", "Droxford"] },
  { label: "Solent and the coast", keywords: ["solent", "portsmouth", "southampton", "isle of wight"], words: ["Solent", "Ferry", "Harbour", "Spinnaker", "Yachts", "Hovercraft", "Cowes", "Marina", "Dockyard", "Tide", "Southsea", "Hamble", "Lighthouse", "Sailing", "Victory", "Beaulieu"] },
  { label: "Transport", keywords: ["transport", "travel", "vehicle", "vehicles"], words: ["Car", "Bus", "Train", "Bicycle", "Ferry", "Taxi", "Lorry", "Tram", "Scooter", "Aeroplane", "Coach", "Tractor", "Van", "Yacht", "Helicopter", "Motorbike"] },
  { label: "Holidays", keywords: ["holiday", "holidays", "vacation", "travel abroad"], words: ["Suitcase", "Passport", "Airport", "Beach", "Hotel", "Postcard", "Sunglasses", "Camping", "Cruise", "Sunbathing", "Map", "Souvenir", "Caravan", "Ferry", "Snorkel", "Relax"] },
  { label: "Countries", keywords: ["country", "countries", "world", "geography"], words: ["France", "Spain", "Italy", "Greece", "Germany", "Portugal", "Ireland", "Norway", "Canada", "Brazil", "Japan", "India", "Egypt", "Mexico", "Australia", "Kenya"] },
  { label: "Space", keywords: ["space", "planet", "planets", "stars", "astronomy"], words: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Moon", "Comet", "Galaxy", "Rocket", "Astronaut", "Orbit", "Meteor", "Telescope"] },
  // ─── Everyday life ───
  { label: "Colours", keywords: ["colour", "colours", "color", "rainbow"], words: ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet", "Pink", "Purple", "Turquoise", "Scarlet", "Silver", "Golden", "Crimson", "Lilac", "Emerald"] },
  { label: "Clothes", keywords: ["clothes", "clothing", "fashion", "wardrobe"], words: ["Jumper", "Trousers", "Skirt", "Dress", "Jacket", "Scarf", "Gloves", "Socks", "Shoes", "Boots", "Cardigan", "Raincoat", "Pyjamas", "Shirt", "Wellies", "Hat"] },
  { label: "Jobs", keywords: ["job", "jobs", "careers", "people who help us"], words: ["Teacher", "Nurse", "Doctor", "Baker", "Builder", "Farmer", "Plumber", "Postman", "Librarian", "Chef", "Pilot", "Vet", "Dentist", "Florist", "Butcher", "Gardener"] },
  { label: "School", keywords: ["school", "back to school", "classroom"], words: ["Teacher", "Pencil", "Uniform", "Lunchbox", "Homework", "Playground", "Library", "Assembly", "Ruler", "Satchel", "Maths", "Spelling", "History", "Science", "Register", "Holidays"] },
  { label: "Royal family", keywords: ["royal", "king", "queen", "coronation", "jubilee"], words: ["King", "Queen", "Crown", "Palace", "Throne", "Prince", "Princess", "Windsor", "Corgi", "Jubilee", "Coronation", "Balmoral", "Sceptre", "Royal", "Guards", "Banquet"] },
  { label: "Community", keywords: ["community", "village", "neighbour", "charity", "volunteer"], words: ["Neighbour", "Village", "Library", "Church", "Fete", "Volunteer", "Charity", "Bakery", "Market", "Post office", "Pub", "Park", "School", "Club", "Garden", "Friendly"] },
];

const BLOCKED_THEME = /[^a-z0-9 '&-]/g;

// The list for a typed theme ("Garden birds", "christmas fun", "Hampshire"),
// or null if there isn't one.
export function themeFor(theme: string): ThemeList | null {
  const t = ` ${theme.toLowerCase().replace(BLOCKED_THEME, " ").replace(/\s+/g, " ").trim()} `;
  if (t.trim().length < 3) return null;
  // The theme's own name first, then its keywords (longest first, so
  // "afternoon tea" beats "tea").
  const byLabel = themeLists.find((l) => t.includes(` ${l.label.toLowerCase().replace(/[^a-z0-9 ]/g, "")} `) || t.trim() === l.label.toLowerCase());
  if (byLabel) return byLabel;
  const keys = themeLists.flatMap((l) => l.keywords.map((k) => ({ k, l }))).sort((a, b) => b.k.length - a.k.length);
  return keys.find(({ k }) => t.includes(` ${k} `) || t.includes(` ${k}s `))?.l ?? null;
}

// Suggested words for a theme and grid: a random pick (so puzzles on the same
// theme differ), only words that fit, about one word per grid row.
export function suggestWords(list: ThemeList, grid: number, rand: () => number = Math.random) {
  const fit = list.words.filter((w) => w.replace(/[^A-Za-z]/g, "").length <= grid);
  const shuffled = [...fit].sort(() => rand() - 0.5);
  return shuffled.slice(0, grid <= 10 ? 10 : grid <= 12 ? 13 : 16);
}
