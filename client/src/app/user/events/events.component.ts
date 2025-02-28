import { ChangeDetectionStrategy, Component, isDevMode, OnInit, signal, WritableSignal } from "@angular/core"
import { FooterComponent } from "@components/footer/footer.component"
import { faCalendar, faInfoCircle, faMapMarker, faMoneyBill, faSpinner, faUser, faWarning } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { DatesService } from "@services/dates.service"
import { EventsService } from "@services/events.service"
import { ContactComponent } from "@components/contact/contact.component"
import { SliderComponent } from "@components/slider/slider.component"
import { FormGroup } from "@angular/forms"
import { FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { QuestionnaireComponent } from "./questionnaire/questionnaire.component"
import { ActivatedRoute, Router } from "@angular/router"

@Component ( {
  selector: "app-events",
  imports: [
    FooterComponent,
    FaIconComponent,
    ContactComponent,
    SliderComponent,
    FormlyModule
  ],
  templateUrl: "./events.component.html",
  styleUrl: "./events.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventsComponent implements OnInit {
  public readonly events: WritableSignal<Array<any>> = signal ( [ ] )
  public readonly questionnaires: WritableSignal<Array<{
    title: string
    description: string
    price: number
    location: string
    image: string
    start: string
    end: string
    form: FormGroup
    fields: FormlyFieldConfig[]
    model: any
  }>> = signal ( [
      {
        id: "journey-to-rome",
        title: "'Journey to Rome' - Expression of Interest",
        description: "Join us on a pilgrimage to the Eternal City for the Marian Jubilee. Express your interest by completing the form below. Includes flights, accomodation, breakfast and lunch.",
        price: 650,
        location: "Rome, Italy",
        image: "assets/img/trip-to-rome.png",
        start: "Tue 7th Oct 2025",
        end: "Sun 12th Oct 2025",
        form: new FormGroup ( { } ),
        fields: [
          {
            key: "name",
            type: "input",
            props: {
              type: "text",
              label: "Name",
              required: true
            }
          },
          {
            key: "email",
            type: "input",
            props: {
              type: "email",
              label: "Email",
              required: true
            },
            validators: {
              emailValidator: {
                expression: ( c: any ) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test ( c.value ),
                message: "Invalid Email",
              }
            }
          },
          {
            key: "questions",
            type: "textarea",
            props: {
              label: "Questions",
              required: true
            }
          },
          {
            key: "interest",
            type: "checkbox",
            props: {
              label: "Are you interested in joining us on this pilgrimage?",
              required: false
            }
          }
        ],
        model: {
          interest: false
        }
      }
    ] )
  public quote = "Prayer, as a means of drawing ever new strength from Christ, is concretely and urgently needed."
  public quoteAuthor = "Benedict XVI"

  public readonly loading: WritableSignal<boolean> = signal ( true )
  public readonly error: WritableSignal<boolean> = signal ( false )
  public readonly errorMessage: WritableSignal<string> = signal ( "" )

  public faSpinner = faSpinner
  public faError = faWarning
  public faMoney = faMoneyBill
  public faMapMarker = faMapMarker
  public faCalendar = faCalendar
  public faInfo = faInfoCircle
  public faPerson = faUser

  public constructor (
    public eventsSvc: EventsService,
    public dateSvc: DatesService,
    private modalSvc: NgbModal,
    private activeRoute: ActivatedRoute,
    private router: Router
  ) { }

  public ngOnInit ( ) {
    const chunkSize = 2
    this.eventsSvc.getEvents ( ).then ( ( events: Array<any> ) => {
      for ( let i = 0; i < events.length; i += chunkSize ) {
        const row = events.slice ( i, i + chunkSize )
        this.events.set ( [
          ...this.events ( ),
          row
        ] )
      }
    } ).catch ( ( error: any ) => {
      if ( isDevMode ( ) ) {
        console.error ( error )
      }
      this.error.set ( true )
    } ).finally ( ( ) => {
      if ( this.activeRoute.snapshot.queryParamMap.get ( "questionnaire-id" ) ) {
        const event = this.questionnaires ( ).find ( ( questionnaire: any ) => {
          return questionnaire.id === this.activeRoute.snapshot.queryParamMap.get ( "questionnaire-id" )
        } )
        if ( event ) {
          this.openQuestionnaire ( event )
        }
      }
      this.router.navigate ( [ ], {
        replaceUrl: true
      } )
      this.loading.set ( false )
    } )
  }

  public openQuestionnaire ( event: any ) {
    const modalRef = this.modalSvc.open ( QuestionnaireComponent, {
      size: "xl"
    } )
    modalRef.componentInstance.event = event
  }
}
