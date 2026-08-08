import { FormlyFieldConfig } from "@ngx-formly/core"
import { FormlyService } from "../../../services/formly.service"
import { SolidIcon, BrandIcon } from "../../../icon/icon.registry"

export interface AboutCard {
  icon: SolidIcon | BrandIcon
  title: string
  description: string
}

export interface Testimony {
  name: string
  testimony: string
}

export interface StoryItem {
  description: string
  bullet: boolean
}

export const DEFAULT_SLIDES = [
  {
    id: "hero-1",
    title: "Revive Scotland",
    description: "We are dedicated to reviving the faith in people's hearts through the power of the Holy Spirit. We deliver this through formation, community and prayer; mainly Pilgrimages, Revive Weekends and Eucharistic Adoration.",
    url: "gallery/kinloss/kinloss-13.jpg"
  },
  {
    id: "hero-2",
    title: "Join the Prayer",
    description: "Revive exists to give people a real and transformational HOPE, through a FAITH filled lifestyle centered on the sacraments, catechesis and real authentic friendships as a way to encounter God's LOVE.",
    url: "gallery/dunoon/dunoon-1.jpg"
  },
  {
    id: "hero-3",
    title: "God is Love",
    description: "'Let anyone who is thirsty come to me and drink. Whoever believes in me, as Scripture has said, rivers of living water will flow from within them. By this he meant the Holy Spirit' (Jn 7:38-39)",
    url: "gallery/skye/skye-1.jpg"
  }
]

export const DEFAULT_WEEKENDS = {
  title: "Revive Weekends",
  videoUrl: "/api/img/gallery/kinloss/kinloss-14.mp4",
  description: "A Revive Weekend is a profound Catholic experience designed to delve deeper into specific aspects of the faith while fostering a sense of community and spiritual growth among young adults.\n\nRooted in prayer, particularly through the Mass, adoration and the rosary, these weekends offer participants an opportunity for profound spiritual renewal and connection with God. The core aim of Revive Weekends is to bring young adults together in a supportive environment where they can deepen their understanding of the Catholic faith and build lasting friendships.\n\nAlongside structured prayer, Revive Weekends also include quality social time, engaging games, and thoughtful discussions aimed at facilitating personal reflection and sharing.\n\nWhether through moments of worship, fellowship, or recreation, Revive Weekends provide an experience that nurtures both the soul and the spirit, empowering participants to grow in their faith and relationship with God while forging meaningful connections with others on the journey of faith."
}

export const DEFAULT_PILGRIMAGE = {
  heading: "Pilgrimages",
  body: "All our pilgrimages are in a true spirit of simplicity where we forgo the luxuries and pleasures of the world in order to be able to appreciate the basic things in life. All pilgrimages include daily mass and prayer time and a series of formational talks. We are also able to design and lead pilgrimages suited for parish, youth and other groups. Please contact us directly if you wish to set up a custom pilgrimage.",
  image: "pilgrimage.jpg"
}

export const DEFAULT_ADORATION = {
  title: "Adoration Missions",
  body: "We offer to run a parish adoration mission in which we work together with the parish priest to prepare and run continuous adoration for set periods of time either with the goal of increasing already existing adoration in the parish or to help begin this devotional practice. For more information on what a mission can look like, please Contact Us.",
  mediaUrl: "adoration.jpg"
}

export const DEFAULT_ABOUT_CARDS: AboutCard [ ] = [
  {
    icon: "bible",
    title: "Scripture",
    description: "We promote the basic message of the Gospel and the transformative truth that the Holy Spirit is living and active within hearts that are in a state of grace."
  },
  {
    icon: "church",
    title: "Transformed by the Spirit",
    description: "We aim to provide a space for people to encounter the love of God and to be transformed by the power of the Holy Spirit."
  },
  {
    icon: "praying-hands",
    title: "Prayer",
    description: "We cultivate a deep, personal relationship with Jesus Christ through regular prayer, the sacraments, and adoration."
  },
  {
    icon: "users",
    title: "Community",
    description: "We build authentic, supportive relationships where individuals can journey together in faith and encourage one another."
  }
]

export const DEFAULT_TESTIMONIALS: Testimony [ ] = [
  { name: "Largs - 2023", testimony: "I loved the talks and company and the overall structure of the retreat. Incredible experience." },
  { name: "Hawick - 2023", testimony: "This has made me want to create better friendships and discipleship in our parishes and to become a light for our communities" },
  { name: "Largs - 2023", testimony: "There was a lot of time for adoration and the games were great fun, the talks were amazing and it was a great choice of topics and speakers" },
  { name: "Largs - 2023", testimony: "The schedule was well organised, the food was well-organised and the talks were very interesting – I loved the testimonies from the priests" },
  { name: "Dunoon - 2026", testimony: "The content has given me a new perspective on scripture, the mass and liturgy which helps me to appreciate more fully its inherent beauty" },
  { name: "Dunoon - 2026", testimony: "I have grown in a deeper understanding of a relationship with God and others" },
  { name: "Dunoon - 2026", testimony: "I had new revelations about my faith and how I can grow and improve my relationship with God and others" },
  { name: "Dunoon - 2026", testimony: "This weekend made me rediscover myself in the light of God and the needs I can work on! Thank you so much for organising, I really enjoyed being a part of this community" },
  { name: "Dunoon - 2026", testimony: "I have learnt so much over the weekend. Going into detail about dissonant needs has helped me clarify things to address in my own life and how to work on them. I found this retreat very fruitful" },
  { name: "Dunoon - 2026", testimony: "I have been able to surrender to the will of God more" },
  { name: "Dunoon - 2026", testimony: "Finding out how men and women most closely imitate the Blessed Trinity when they're embracing in marital union was so healing and such a beautiful truth that has been revealed to me this weekend!" },
  { name: "Dunoon - 2026", testimony: "Very profound encounter with the goodness of God and His plan for human relationships, marriage and liturgy. Father's talks were deep but relatable and I loved the vulnerability of the men's groups discussion." }
]

export const DEFAULT_STORY: StoryItem [ ] = [
  {
    bullet: false,
    description: "At Revive Scotland, our journey is deeply informed by a robust background in catechesis, bolstered by academic achievements including both a BA in Catholic Theology and an MA in Applied Catholic Theology. This academic foundation enriches our understanding and practice of the faith, enabling us to effectively convey its teachings and significance to others."
  },
  {
    bullet: true,
    description: "Our commitment to youth work under the patronage of St John Bosco extends beyond mere engagement, encompassing a holistic approach to nurturing spiritual growth and real friendships."
  },
  {
    bullet: true,
    description: "Alongside organising pilgrimages, Revive Weekends and other events such as our recent trip to World Youth Day, our dedication to parish-related apostolates especially building Eucharistic Adoration and parish youth groups underscore our hands-on involvement in the everyday life of the Church."
  },
  {
    bullet: true,
    description: "We take pride in fostering transformative spaces through the development and leadership of children's, youth, and young adults groups, providing avenues for exploration and growth in the Catholic faith. Furthermore, we provide comprehensive leadership training for youth group leaders, empowering them to effectively guide and mentor others in their spiritual journeys."
  },
  {
    bullet: false,
    description: "Because of our experience in organising and leading Eucharistic adoration at both parish and mission levels, we are steadfast in our commitment to fostering deep reverence and devotion within our communities. At Revive Scotland, we are dedicated to inspiring spiritual renewal and fostering community cohesion, drawing upon our diverse backgrounds and experiences to serve as catalysts for transformation and growth."
  }
]

export const getSlideFields = ( formlySvc: FormlyService ): FormlyFieldConfig [ ] => {
  return [
    formlySvc.TextInput ( "title", { label: "Title", placeholder: "Enter slide title", required: true, maxLength: 100 } ),
    formlySvc.TextAreaInput ( "description", { label: "Text", placeholder: "Enter slide description", required: true, maxLength: 500, includeMaxDescription: true } ),
    formlySvc.ImagePickerInput ( "url", { label: "Background Media", required: true, attributes: { accept: "image/*,video/*" } } )
  ]
}

export const getWeekendsFields = ( formlySvc: FormlyService ): FormlyFieldConfig [ ] => {
  return [
    formlySvc.TextInput ( "title", { label: "Title", required: true, maxLength: 100 } ),
    formlySvc.TextAreaInput ( "description", { label: "Description", required: true, maxLength: 2000, includeMaxDescription: true } ),
    formlySvc.ImagePickerInput ( "videoUrl", { label: "Background Media", placeholder: "Select or enter media URL", required: true, attributes: { accept: "image/*,video/*" } } )
  ]
}
