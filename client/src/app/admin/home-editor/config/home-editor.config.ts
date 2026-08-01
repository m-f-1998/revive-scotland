import { FormlyFieldConfig } from "@ngx-formly/core"
import { FormlyService } from "../../../services/formly.service"

export interface AboutCard {
  icon: string
  title: string
  description: string
}

export const DEFAULT_SLIDES = [
  {
    id: "hero-1",
    title: "Encounter Christ",
    description: "Join us in our mission to bring the love of God to the people of Scotland.",
    url: "gallery/skye/skye-1.jpg"
  },
  {
    id: "hero-2",
    title: "Grow in Faith",
    description: "Discover resources, events, and a community dedicated to spiritual renewal.",
    url: "gallery/skye/skye-3.jpg"
  }
]

export const DEFAULT_WEEKENDS = {
  heading: "Revive Weekends",
  subHeading: "A profound Catholic experience designed to delve deeper into specific aspects of the faith.",
  image: "motherwell-group-photo.jpg",
  description: "A Revive Weekend is a profound Catholic experience designed to delve deeper into specific aspects of the faith while fostering a sense of community and spiritual growth among young adults.\n\nRooted in prayer, particularly through the Mass, adoration and the rosary, these weekends offer participants an opportunity for profound spiritual renewal and connection with God. The core aim of Revive Weekends is to bring young adults together in a supportive environment where they can deepen their understanding of the Catholic faith and build lasting friendships.\n\nAlongside structured prayer, Revive Weekends also include quality social time, engaging games, and thoughtful discussions aimed at facilitating personal reflection and sharing.\n\nWhether through moments of worship, fellowship, or recreation, Revive Weekends provide an experience that nurtures both the soul and the spirit, empowering participants to grow in their faith and relationship with God while forging meaningful connections with others on the journey of faith."
}

export const DEFAULT_PILGRIMAGE = {
  heading: "Pilgrimages",
  body: "All our pilgrimages are in a true spirit of simplicity where we forgo the luxuries and pleasures of the world in order to be able to appreciate the basic things in life. All pilgrimages include daily mass and prayer time and a series of formational talks. We are also able to design and lead pilgrimages suited for parish, youth and other groups. Please contact us directly if you wish to set up a custom pilgrimage.",
  image: "pilgrimage.jpg"
}

export const DEFAULT_ADORATION = {
  title: "Adoration Missions",
  body: "We offer to run a parish adoration mission in which we work together with the parish priest to prepare and run continuous adoration for set periods of time either with the goal of increasing already existing adoration in the parish or to help begin this devotional practice. For more information on what a mission can look like, please Contact Us."
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

export const getSlideFields = ( formlySvc: FormlyService ): FormlyFieldConfig [ ] => {
  return [
    formlySvc.TextInput ( "title", { label: "Title", placeholder: "Enter slide title", required: true, maxLength: 100 } ),
    formlySvc.TextAreaInput ( "description", { label: "Text", placeholder: "Enter slide description", required: true, maxLength: 500, includeMaxDescription: true } ),
    formlySvc.ImagePickerInput ( "url", { label: "Image", required: true } )
  ]
}
