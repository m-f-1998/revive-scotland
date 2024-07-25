import { Component } from "@angular/core"
import { faPencil, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { AdminService } from "@services/AdminService.service"
import { HttpService } from "@services/HttpService.service"

@Component ( {
  selector: "app-registrations",
  standalone: true,
  imports: [ ],
  templateUrl: "./registrations.component.html",
  styleUrl: "./registrations.component.scss"
} )
export class AdminRegistrationsComponent {
  public registrations: any[] = []

  public faTrash = faTrash
  public faEdit = faPencil
  public faPlus = faPlus

  public constructor (
    public adminService: AdminService,
    private httpSvc: HttpService,
    private ngModal: NgbModal
  ) {
    this.httpSvc.request ( "/secure/get.php", {
      "type": "event_bookings"
    } ).then ( ( res: any ) => {
      this.registrations = res
      console.log ( res )
    } )
  }
}
