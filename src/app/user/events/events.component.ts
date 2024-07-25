import { Component, OnInit } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { faSpinner, faWarning } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { HttpService } from "@services/HttpService.service"

@Component ( {
  selector: "app-events",
  standalone: true,
  imports: [
    FooterComponent,
    FaIconComponent
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss"
} )
export class EventsComponent implements OnInit {
  public events: any[][] = [ ]
  public quote = "Prayer, as a means of drawing ever new strength from Christ, is concretely and urgently needed."
  public quoteAuthor = "Benedict XVI"

  public loading = true
  public error = false

  public faSpinner = faSpinner
  public faError = faWarning

  constructor (
    private httpClient: HttpService
  ) { }

  public ngOnInit ( ) {
    this.httpClient.request ( "/get.php", {
      "type": "event"
    } ).then ( ( data: any ) => {
      const chunkSize = 2
      for ( let i = 0; i < data.length; i += chunkSize ) {
        this.events.push ( data.slice ( i, i + chunkSize ) )
      }
      this.loading = false
    } ).catch ( e => {
      console.error ( e )
      this.error = true
      this.loading = false
    } )
  }
}
