import { Component } from "@angular/core"

@Component ( {
  selector: "app-testimony",
  standalone: true,
  imports: [],
  templateUrl: "./testimony.component.html",
  styleUrl: "./testimony.component.scss"
} )
export class TestimonyComponent {
  public testimonies = [
    {
      name: "Retreat Participant, Largs 2023",
      testimony: "'I loved the talks and company and the overall structure of the retreat. Incredible experience.'"
    },
    {
      name: "Revive Weekend Participant, Hawick 2023",
      testimony: "'This has made me want to create better friendships and discipleship in our parishes and to become a light for our communities'"
    },
    {
      name: "Revive Weekend Participant, Largs 2023",
      testimony: "'There was a lot of time for adoration and the games were great fun, the talks were amazing and it was a great choice of topics and speakers'"
    },
    {
      name: "Revive Weekend Participant, Largs 2023",
      testimony: "'The schedule was well organised, the food was well-organised and the talks were very interesting – I loved the testimonies from the priests'"
    }
  ]
}
