import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-revive-weekends",
  templateUrl: "./revive-weekends.component.html",
  styleUrl: "./revive-weekends.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ReviveWeekendsComponent {
  public img = "assets/img/revive-weekends.jpg"
  public title = "Revive Weekends"
  public description = "A Revive Weekend is a profound Catholic experience designed to delve deeper into specific aspects of the faith while fostering a sense of community and spiritual growth among young adults.\n\nRooted in prayer, particularly through the Mass, adoration and the rosary, these weekends offer participants an opportunity for profound spiritual renewal and connection with God. The core aim of Revive Weekends is to bring young adults together in a supportive environment where they can deepen their understanding of the Catholic faith and build lasting friendships.\n\nAlongside structured prayer, Revive Weekends also include quality social time, engaging games, and thoughtful discussions aimed at facilitating personal reflection and sharing.\n\nWhether through moments of worship, fellowship, or recreation, Revive Weekends provide a holistic experience that nurtures both the soul and the spirit, empowering participants to grow in their faith and relationship with God while forging meaningful connections with others on the journey of faith."
}
