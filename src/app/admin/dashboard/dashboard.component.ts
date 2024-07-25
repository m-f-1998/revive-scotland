import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '@services/AdminService.service';
import { HttpService } from '@services/HttpService.service';
import { AdminPolicyComponent } from '../components/policy/policy.component';
import { CurrencyPipe } from '@angular/common';
import { AdminDocumentComponent } from '../components/document/document.component';
import { faPencil, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

@Component ( {
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CurrencyPipe,
    FaIconComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
} )
export class AdminDashboardComponent {
  public events: any[] = []

  public faTrash = faTrash
  public faEdit = faPencil
  public faPlus = faPlus

  public constructor (
    public adminService: AdminService,
    private httpSvc: HttpService,
    private ngModal: NgbModal
  ) {
    this.httpSvc.request ( "/secure/get.php", {
      "type": "event"
    } ).then ( ( res: any ) => {
      this.events = res
    } )
  }

  public openPolicy ( title: string ) {
    const modalRef = this.ngModal.open ( AdminPolicyComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = title
  }

  public openDoc ( title: string, link: string ) {
    const modalRef = this.ngModal.open ( AdminDocumentComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = title
    modalRef.componentInstance.documentLink = link
  }

  public deleteEvent ( id: string ) {
    // TODO: Implement delete event
  }

  public addEvent ( ) {
    // TODO: Implement add event
  }

  public editEvent ( id: string ) {
    // TODO: Implement edit event
  }

}
