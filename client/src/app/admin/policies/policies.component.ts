import { Component } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faPencil, faPlus, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { AdminService } from "@services/AdminService.service"
import { HttpService } from "@services/HttpService.service"
import { ToastrService } from "ngx-toastr"
import { PolicyEditComponent } from "../components/policy-edit/policy-edit.component"
import { PolicyAddComponent } from "../components/policy-add/policy-add.component"

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
  public faSpinner = faSpinner

  public loading = true

  public constructor (
    public adminService: AdminService,
    private httpSvc: HttpService,
    private ngModal: NgbModal,
    private toastrSvc: ToastrService
  ) {
    this.getPolicies ( )
  }

  public getPolicies ( ) {
    this.httpSvc.request ( "/policies.php" ).then ( ( res: any ) => {
      this.policies = res
    } ).catch ( e => {
      console.error ( e )
      this.toastrSvc.error ( "Failed to Load Policies" )
    } ).finally ( ( ) => {
      this.loading = false
    } )
  }

  public deletePolicy ( id: string ) {
    const category = this.policies.find ( x => x.id === id ).category
    if ( this.policies.filter ( x => x.category === category ).length === 1 ) {
      this.toastrSvc.info ( "You Must Have At Least One Policy For Each Category" )
    } else {
      this.httpSvc.request ( "/policies.php", {
        "id": id
      }, "DELETE" ).then ( ( ) => {
        this.policies = this.policies.filter ( x => x.id !== id )
        this.toastrSvc.success ( "Policy Deleted" )
      } ).catch ( e => {
        if ( e.status === 409 ) {
          this.toastrSvc.error ( "This Policy is Already in Use" )
        } else {
          this.toastrSvc.error ( "Failed to Delete Policy" )
        }
      } )
    }
  }

  public addPolicy ( ) {
    const modalRef = this.ngModal.open ( PolicyAddComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.categories = this.policies [ 0 ].categories
    modalRef.result.finally ( ( ) => {
      this.getPolicies ( )
    } )
  }

  public viewPolicy ( policy: any ) {
    const modalRef = this.ngModal.open ( PolicyEditComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.policy = policy
  }
}
