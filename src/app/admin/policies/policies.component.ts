import { Component } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faPencil, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { AdminService } from "@services/AdminService.service"
import { HttpService } from "@services/HttpService.service"

@Component ( {
  selector: "app-admin-policies",
  standalone: true,
  imports: [
    FaIconComponent
  ],
  templateUrl: "./policies.component.html",
  styleUrl: "./policies.component.scss"
} )
export class AdminPoliciesComponent {
  public policies: any[] = []

  public faTrash = faTrash
  public faEdit = faPencil
  public faPlus = faPlus

  public constructor (
    public adminService: AdminService,
    private httpSvc: HttpService,
    private ngModal: NgbModal
  ) {
    this.httpSvc.request ( "/secure/get.php", {
      "type": "policy"
    } ).then ( ( res: any ) => {
      this.policies = res
    } )
  }

  public openPolicy ( title: string ) {
    const modalRef = this.ngModal.open ( AdminPoliciesComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = title
  }

  public deletePolicy ( id: string ) {
    // TODO: Implement delete event
  }

  public addPolicy ( ) {
    // TODO: Implement add event
  }

  public editPolicy ( id: string ) {
    // TODO: Implement edit event
  }
}
