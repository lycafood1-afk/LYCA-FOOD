export type ProductGroup = { name: string; items: string[] }
export type Category = {
  id: string
  title: string
  shortTitle: string
  description: string
  image: string
  imageAlt: string
  imageCaption: string
  groups: ProductGroup[]
  note?: string
}

const images = {
  fruit: "/images/fruit.webp",
  citrus: "/images/citrus.webp",
  mango: "/images/mango.webp",
  coconut: "/images/coconut.webp",
  coffee: "/images/coffee.webp",
  dairy: "/images/dairy.webp",
  berries: "/images/berries.webp",
  powder: "/images/powder.webp",
  colors: "/images/colors.webp",
  cocoa: "/images/cocoa.webp",
  tomato: "/images/tomato.webp",
  patisserie: "/images/patisserie.webp",
  dessert: "/images/dessert.webp",
  blueberries: "/images/blueberries.webp",
}

export { images }

export const categories: Category[] = [
  {
    id: "juice-concentrates",
    title: "Juice Concentrates, Purees, Pulps & Pastes",
    shortTitle: "Juice & Fruit Ingredients",
    description:
      "A broad fruit and vegetable portfolio for beverage, dairy, bakery, sauce, and food manufacturing applications.",
    image: images.mango,
    imageAlt: "Mango juice and freshly sliced mango against a dark backdrop",
    imageCaption: "MANGO / CONCENTRATES & PUREES",
    groups: [
      {
        name: "Mango",
        items: [],
      },
      {
        name: "Guava",
        items: [],
      },
      {
        name: "Tomato",
        items: [],
      },
      {
        name: "Chilli, Pepper, Ginger & Garlic",
        items: [],
      },
      {
        name: "Other Concentrates & Purees",
        items: [],
      },
    ],
    note: "Brochure packaging formats include aseptic packs, aseptic bins, cans, frozen products, and concentrates. Sizes vary by format, and availability should be confirmed for each product.",
  },
  {
    id: "coconut-products",
    title: "Coconut Products",
    shortTitle: "Coconut Products",
    description:
      "Versatile coconut ingredients for confectionery, bakery, beverage, culinary, and prepared food applications.",
    image: images.coconut,
    imageAlt: "Fresh coconut halves and pieces on a dark surface",
    imageCaption: "COCONUT / MILK, OIL & DESICCATED",
    groups: [
      {
        name: "Coconut Range",
        items: [],
      },
    ],
  },
  {
    id: "coffee-cocoa",
    title: "Coffee & Cocoa",
    shortTitle: "Coffee & Cocoa",
    description:
      "Coffee formats and cocoa ingredients for beverages, desserts, confectionery, and manufactured food applications.",
    image: images.coffee,
    imageAlt: "Roasted coffee beans on dark stone",
    imageCaption: "COFFEE & COCOA / AROMA & DEPTH",
    groups: [
      {
        name: "Coffee",
        items: [],
      },
      { name: "Cocoa", items: [] },
    ],
  },
  {
    id: "dairy-ingredients",
    title: "Dairy Ingredients",
    shortTitle: "Dairy Ingredients",
    description:
      "A structured range for dairy, beverage, bakery, nutrition, dessert, and prepared food applications.",
    image: images.dairy,
    imageAlt: "Fresh milk pouring into a glass against black",
    imageCaption: "DAIRY / TEXTURE & RICHNESS",
    groups: [
      {
        name: "Dairy Range",
        items: [],
      },
    ],
  },
  {
    id: "fruit-preparations",
    title: "Fruit Preparations",
    shortTitle: "Fruit Preparations",
    description:
      "Fruit preparations developed for integration across a wide range of finished food and beverage formats.",
    image: images.berries,
    imageAlt: "Raspberries reflected on a black surface",
    imageCaption: "FRUIT PREPARATIONS / FLAVOUR & TEXTURE",
    groups: [
      {
        name: "Applications",
        items: [],
      },
    ],
  },
  {
    id: "spray-dried-powders",
    title: "Spray-Dried Powders",
    shortTitle: "Spray-Dried Powders",
    description:
      "Fruit, specialty, and natural colour powders presented in an easy-to-browse ingredient collection.",
    image: images.powder,
    imageAlt: "Fresh mangoes, a source fruit for the fruit powder range",
    imageCaption: "FRUIT & SPECIALTY POWDERS / SOURCE FRUIT",
    groups: [
      {
        name: "Fruit Powders",
        items: [],
      },
      {
        name: "Specialty Powders",
        items: [],
      },
      {
        name: "Natural Colour Powders",
        items: [],
      },
    ],
  },
  {
    id: "food-colours",
    title: "Food Colours",
    shortTitle: "Food Colours",
    description:
      "A varied palette of plant-derived colour ingredients for food and beverage product development.",
    image: images.colors,
    imageAlt: "Deep red dried hibiscus flowers, a botanical colour source",
    imageCaption: "HIBISCUS / COLOUR FROM NATURE",
    groups: [
      {
        name: "Natural Colour Range",
        items: [],
      },
    ],
  },
]

export const offices = [
  {
    country: "United Arab Emirates",
    city: "SPC Free Zone, Sharjah, UAE",
    phone: "+971 50 6361790",
    email: "mohamed@lycafoods.com",
  },
  {
    country: "Kuwait",
    city: "Business Plaza, Kuwait City, Kuwait",
    phone: "+965 98741141 / +965 98021009",
    email: "sales@lycafoods.com",
  },
  {
    country: "India",
    city: "Erode, Tamil Nadu, India",
    phone: "+91 95670 59898",
    email: "sales2@lycafoods.com",
  },
  {
    country: "Egypt",
    city: "Cairo, Egypt",
    phone: "+20 1096028740",
    email: "ruaa.k@lycafoods.com",
  },
  {
    country: "Tanzania",
    city: "Dar es Salaam, Tanzania",
    phone: "+255 655 100 100",
    email: "marcelina.m@lycafoods.com",
  },
  {
    country: "Sri Lanka",
    city: "Nittambuwa, Sri Lanka",
    phone: "+94 76 2407750 / +94 75 1637839",
    email: "mano.p@lycafoods.com",
  },
]
