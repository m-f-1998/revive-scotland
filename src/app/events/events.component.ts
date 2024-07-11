import { Component } from "@angular/core"
import { FooterComponent } from "../components/footer/footer.component"

@Component ( {
  selector: "app-events",
  standalone: true,
  imports: [
    FooterComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss"
} )
export class EventsComponent {
  public events = [
    {
      title: "How to Pray and Why?",
      description: "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna",
      img: "img/hero-bg-1.jpg"
    },
    {
      title: "Adoration",
      description: "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna",
      img: "img/hero-bg-2.jpg"
    },
    {
      title: "Different Spiritualities",
      description: "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna",
      img: "img/hero-bg-3.jpg"
    },
    {
      title: "Praying with Scriptures",
      description: "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna",
      img: "img/hero-bg-1.jpg"
    }
  ]

  public quote = "Prayer, as a means of drawing ever new strength from Christ, is concretely and urgently needed."
  public quoteAuthor = "Benedict XVI"
}
