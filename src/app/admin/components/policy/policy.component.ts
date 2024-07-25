import { Component, Input } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faSpinner } from "@fortawesome/free-solid-svg-icons"
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap"
import { HttpService } from "@services/HttpService.service"

@Component ( {
  selector: "app-admin-policy",
  standalone: true,
  imports: [
    FaIconComponent
  ],
  templateUrl: "./policy.component.html"
} )
export class AdminPolicyComponent {
  @Input ( ) public title: string = ""

  public loading = true
  public policy = ""

  public faSpinner = faSpinner

  public constructor (
    private apiSvc: HttpService,
    private activeModal: NgbActiveModal
  ) {
    this.apiSvc.request ( "/secure/get.php", {
      "type": "policy"
    } ).then ( ( res: any ) => {
      this.policy = res.find ( ( x: any ) => x.title === this.title ).description
      this.loading = false
    } )
  }

  public close ( ) {
    this.activeModal.dismiss ( )
  }
}
